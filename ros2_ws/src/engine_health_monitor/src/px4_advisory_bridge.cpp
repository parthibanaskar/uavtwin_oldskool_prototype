// px4_advisory_bridge.cpp
//
// Subscribes to our EngineTelemetry topic, and to PX4's own
// vehicle_status / vehicle_command topics over the standard PX4 ROS 2
// uXRCE-DDS bridge (px4_msgs package -- this is REAL, documented PX4
// integration, not invented API).
//
// Implements USP 03 (GCS decision-support advisory overlay) and the
// "graduated fault-severity response" trigger from the dossiers: on a
// fault_flag from the digital twin, it does NOT command the flight
// controller directly (a hackathon prototype should not autonomously
// fly the aircraft) -- it publishes an advisory + logs to the
// tamper-evident black-box topic, leaving flight-critical commands to
// PX4's own safety logic and the operator, unless/until your team
// explicitly signs off on closed-loop autonomy for the demo.
//
// Build: standard ament_cmake / colcon build, depends on px4_msgs
// (install via https://github.com/PX4/px4_msgs, matched to your PX4
// firmware version).

#include <rclcpp/rclcpp.hpp>
#include <px4_msgs/msg/vehicle_status.hpp>
#include <px4_msgs/msg/vehicle_local_position.hpp>
#include "engine_health_monitor/msg/engine_telemetry.hpp"
#include <std_msgs/msg/string.hpp>

using std::placeholders::_1;

class Px4AdvisoryBridge : public rclcpp::Node
{
public:
  Px4AdvisoryBridge() : Node("px4_advisory_bridge")
  {
    // PX4 uXRCE-DDS topics use the px4_msgs types and, by PX4 convention,
    // a QoS profile matching rclcpp::SensorDataQoS() (best-effort).
    vehicle_status_sub_ = this->create_subscription<px4_msgs::msg::VehicleStatus>(
      "/fmu/out/vehicle_status", rclcpp::SensorDataQoS(),
      std::bind(&Px4AdvisoryBridge::vehicle_status_callback, this, _1));

    local_pos_sub_ = this->create_subscription<px4_msgs::msg::VehicleLocalPosition>(
      "/fmu/out/vehicle_local_position", rclcpp::SensorDataQoS(),
      std::bind(&Px4AdvisoryBridge::local_position_callback, this, _1));

    telemetry_sub_ = this->create_subscription<engine_health_monitor::msg::EngineTelemetry>(
      "engine/telemetry", 10,
      std::bind(&Px4AdvisoryBridge::telemetry_callback, this, _1));

    advisory_pub_ = this->create_publisher<std_msgs::msg::String>(
      "engine/gcs_advisory", 10);

    blackbox_pub_ = this->create_publisher<std_msgs::msg::String>(
      "engine/blackbox_log", rclcpp::QoS(50).reliable());  // reliable: this is evidence, don't drop it

    RCLCPP_INFO(this->get_logger(),
      "px4_advisory_bridge up: advisory-only mode (no autonomous flight commands)");
  }

private:
  void vehicle_status_callback(const px4_msgs::msg::VehicleStatus::SharedPtr msg)
  {
    last_arming_state_ = msg->arming_state;
  }

  void local_position_callback(const px4_msgs::msg::VehicleLocalPosition::SharedPtr msg)
  {
    // PX4 local position is NED, meters; convert down-axis to a rough
    // altitude AGL for the glide-footprint calc downstream (§6.2 of the
    // formula reference).
    current_altitude_m_ = -msg->z;
  }

  void telemetry_callback(const engine_health_monitor::msg::EngineTelemetry::SharedPtr msg)
  {
    // --- tamper-evident black-box log: EVERY reading, not just faults ---
    log_to_blackbox(*msg);

    if (!msg->fault_flag) {
      return;
    }

    // --- graduated response: classify severity, don't binary-shutdown ---
    std::string severity = classify_severity(*msg);

    std_msgs::msg::String advisory;
    advisory.data =
      "[ADVISORY] fault_class=" + msg->fault_class +
      " severity=" + severity +
      " predicted_RUL_cycles=" + std::to_string(msg->predicted_rul_cycles) +
      " altitude_m=" + std::to_string(current_altitude_m_) +
      " -- recommend operator review before any power reduction.";
    advisory_pub_->publish(advisory);
    RCLCPP_WARN(this->get_logger(), "%s", advisory.data.c_str());

    // NOTE (deliberately NOT implemented here): actually commanding
    // PX4 (e.g. publishing VehicleCommand for RTL/divert) is a
    // flight-safety decision your team must make explicitly and test
    // extensively in SITL before any real airframe -- wiring it in is a
    // few more lines (publish px4_msgs::msg::VehicleCommand on
    // /fmu/in/vehicle_command with MAV_CMD_NAV_RETURN_TO_LAUNCH), but
    // it should not be silently enabled by default.
  }

  std::string classify_severity(const engine_health_monitor::msg::EngineTelemetry & msg)
  {
    // Simple graduated classifier matching USP 04 ("continuable" vs
    // "must-stop") -- replace thresholds with your calibrated values.
    if (msg.predicted_degradation_index > 0.85f) return "CRITICAL";
    if (msg.predicted_degradation_index > 0.6f) return "DEGRADED_CONTINUABLE";
    return "NOMINAL";
  }

  void log_to_blackbox(const engine_health_monitor::msg::EngineTelemetry & msg)
  {
    // Physics-model-prediction-vs-actual-behavior logging (USP 06 /
    // Nishant-referee capability): a real implementation timestamps and
    // cryptographically signs this; that signing step is intentionally
    // out of scope for this skeleton -- swap `log_line` into an
    // HMAC-signed, flash-persisted ring buffer for the real build.
    std_msgs::msg::String log_line;
    log_line.data =
      std::to_string(msg.header.stamp.sec) + "," +
      std::to_string(msg.rpm) + "," + std::to_string(msg.egt_c) + "," +
      std::to_string(msg.predicted_degradation_index) + "," +
      (msg.fault_flag ? "FAULT" : "OK");
    blackbox_pub_->publish(log_line);
  }

  rclcpp::Subscription<px4_msgs::msg::VehicleStatus>::SharedPtr vehicle_status_sub_;
  rclcpp::Subscription<px4_msgs::msg::VehicleLocalPosition>::SharedPtr local_pos_sub_;
  rclcpp::Subscription<engine_health_monitor::msg::EngineTelemetry>::SharedPtr telemetry_sub_;
  rclcpp::Publisher<std_msgs::msg::String>::SharedPtr advisory_pub_;
  rclcpp::Publisher<std_msgs::msg::String>::SharedPtr blackbox_pub_;

  uint8_t last_arming_state_{0};
  double current_altitude_m_{0.0};
};

int main(int argc, char ** argv)
{
  rclcpp::init(argc, argv);
  rclcpp::spin(std::make_shared<Px4AdvisoryBridge>());
  rclcpp::shutdown();
  return 0;
}
