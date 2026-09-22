#ifndef ENGINE_HEALTH_MONITOR__SENSOR_SAMPLER_NODE_HPP_
#define ENGINE_HEALTH_MONITOR__SENSOR_SAMPLER_NODE_HPP_

#include <memory>
#include <string>
#include <rclcpp/rclcpp.hpp>
#include "engine_health_monitor/msg/engine_telemetry.hpp"

namespace engine_health_monitor
{

/**
 * ISensorBackend: hardware abstraction so the node compiles and runs
 * TODAY against a mock backend, and swaps to a real backend (SPI ADC
 * for the AE sensor, CAN/DroneCAN for ECU telemetry, I2C for an
 * alternator current-sense chip, etc.) with zero changes to the ROS
 * node itself -- only a new class implementing this interface.
 *
 * This is the actual seam you asked about: "communication protocol"
 * decisions (SPI vs I2C vs CAN vs USB) live entirely inside a
 * concrete ISensorBackend implementation, not in the node logic.
 */
class ISensorBackend
{
public:
  virtual ~ISensorBackend() = default;

  struct RawReading
  {
    float rpm{0.0f};
    float throttle_pct{0.0f};
    float cht_C{0.0f};
    float egt_C{0.0f};
    float oil_press_kPa{0.0f};
    float oil_temp_C{0.0f};
    float fuel_flow_kgph{0.0f};
    float vibration_rms_g{0.0f};
    float ae_energy_20k_1M_band{0.0f};
    float alternator_ripple_mV{0.0f};
    bool valid{false};
  };

  virtual bool initialize() = 0;
  virtual RawReading read() = 0;
  virtual std::string backend_name() const = 0;
};

/**
 * MockSensorBackend: deterministic synthetic values for development on
 * a laptop with no hardware attached at all. Swap this for
 * SpiAeSensorBackend / CanBusEcuBackend / etc. once hardware is chosen.
 */
class MockSensorBackend : public ISensorBackend
{
public:
  bool initialize() override { return true; }
  RawReading read() override;
  std::string backend_name() const override { return "mock"; }

private:
  double t_{0.0};
};

class SensorSamplerNode : public rclcpp::Node
{
public:
  explicit SensorSamplerNode(std::shared_ptr<ISensorBackend> backend);

private:
  void timer_callback();

  std::shared_ptr<ISensorBackend> backend_;
  rclcpp::Publisher<engine_health_monitor::msg::EngineTelemetry>::SharedPtr publisher_;
  rclcpp::TimerBase::SharedPtr timer_;
  double altitude_ft_{0.0};       // updated from PX4 vehicle_local_position sub in a real build
  double air_density_kgm3_{1.225};
};

}  // namespace engine_health_monitor

#endif  // ENGINE_HEALTH_MONITOR__SENSOR_SAMPLER_NODE_HPP_
