#include "engine_health_monitor/sensor_sampler_node.hpp"
#include <cmath>
#include <random>
#include <chrono>

namespace engine_health_monitor
{

using namespace std::chrono_literals;

ISensorBackend::RawReading MockSensorBackend::read()
{
  // Deterministic-but-varying mock signal so the rest of the pipeline
  // (publisher, inference node, PX4 bridge) can be developed and
  // demoed with zero hardware attached.
  static std::mt19937 rng(42);
  static std::normal_distribution<float> noise(0.0f, 1.0f);

  t_ += 0.1;
  RawReading r;
  r.rpm = 4350.0f + 60.0f * noise(rng);
  r.throttle_pct = 65.0f + 5.0f * std::sin(t_ * 0.05) + noise(rng);
  r.cht_C = 105.0f + 3.0f * std::sin(t_ * 0.02) + noise(rng);
  r.egt_C = 830.0f + 15.0f * std::sin(t_ * 0.02) + 4.0f * noise(rng);
  r.oil_press_kPa = 350.0f + 10.0f * noise(rng);
  r.oil_temp_C = 95.0f + 2.0f * noise(rng);
  r.fuel_flow_kgph = 24.0f + 1.5f * noise(rng);
  r.vibration_rms_g = 1.1f + 0.15f * std::abs(noise(rng));
  r.ae_energy_20k_1M_band = 0.08f + 0.03f * std::abs(noise(rng));
  r.alternator_ripple_mV = 45.0f + 6.0f * noise(rng);
  r.valid = true;
  return r;
}

SensorSamplerNode::SensorSamplerNode(std::shared_ptr<ISensorBackend> backend)
: Node("engine_sensor_sampler"), backend_(std::move(backend))
{
  if (!backend_->initialize()) {
    RCLCPP_FATAL(this->get_logger(), "Failed to initialize sensor backend '%s'",
                 backend_->backend_name().c_str());
    throw std::runtime_error("sensor backend init failed");
  }
  RCLCPP_INFO(this->get_logger(), "Sensor backend '%s' initialized",
              backend_->backend_name().c_str());

  publisher_ = this->create_publisher<engine_health_monitor::msg::EngineTelemetry>(
    "engine/telemetry", rclcpp::QoS(10));

  // 20 Hz sampling -- adjust to your real ADC/CAN bus throughput.
  // The AE FFT-energy feature should itself be computed at a much
  // higher internal rate (>=1 MHz raw sampling, per the PK15I 100-450kHz
  // band) inside the backend, and reported here as a windowed summary.
  timer_ = this->create_wall_timer(50ms, std::bind(&SensorSamplerNode::timer_callback, this));
}

void SensorSamplerNode::timer_callback()
{
  auto reading = backend_->read();
  if (!reading.valid) {
    RCLCPP_WARN(this->get_logger(), "Sensor read invalid, skipping publish");
    return;
  }

  auto msg = engine_health_monitor::msg::EngineTelemetry();
  msg.header.stamp = this->now();
  msg.header.frame_id = "engine_bay";

  msg.altitude_ft = static_cast<float>(altitude_ft_);      // TODO: fill from PX4 sub
  msg.air_density_kgm3 = static_cast<float>(air_density_kgm3_);
  msg.rpm = reading.rpm;
  msg.throttle_pct = reading.throttle_pct;
  msg.cht_c = reading.cht_C;
  msg.egt_c = reading.egt_C;
  msg.oil_press_kpa = reading.oil_press_kPa;
  msg.oil_temp_c = reading.oil_temp_C;
  msg.fuel_flow_kgph = reading.fuel_flow_kgph;
  msg.vibration_rms_g = reading.vibration_rms_g;
  msg.ae_energy_20k_1m_band = reading.ae_energy_20k_1M_band;
  msg.alternator_ripple_mv = reading.alternator_ripple_mV;

  // Left for the downstream inference node to fill in (see
  // rul_inference_node design note in README) -- the sampler's job is
  // ONLY to get clean telemetry onto the bus, not to run the model.
  msg.predicted_degradation_index = 0.0f;
  msg.predicted_rul_cycles = -1.0f;
  msg.fault_flag = false;
  msg.fault_class = "";

  publisher_->publish(msg);
}

}  // namespace engine_health_monitor

int main(int argc, char ** argv)
{
  rclcpp::init(argc, argv);
  auto backend = std::make_shared<engine_health_monitor::MockSensorBackend>();
  try {
    auto node = std::make_shared<engine_health_monitor::SensorSamplerNode>(backend);
    rclcpp::spin(node);
  } catch (const std::exception & e) {
    RCLCPP_FATAL(rclcpp::get_logger("main"), "Fatal: %s", e.what());
    return 1;
  }
  rclcpp::shutdown();
  return 0;
}
