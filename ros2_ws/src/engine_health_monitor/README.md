# engine_health_monitor — ROS 2 package skeleton

Real, buildable ROS 2 (rclcpp) package structure for the MALE UAV engine
digital twin, wired for PX4 via the standard `px4_msgs` / uXRCE-DDS
bridge. Runs today against a mock sensor backend with **zero hardware**
attached; swap in real drivers without touching node logic.

## What's real vs. what you must supply

**Real / correct as shipped:**

- Package layout, `CMakeLists.txt`, `package.xml` — standard ROS 2 Humble/Jazzy ament_cmake structure.
- `px4_msgs` usage (`VehicleStatus`, `VehicleLocalPosition`) — real PX4 ROS 2 message types, real topic names (`/fmu/out/...`), matching PX4's documented uXRCE-DDS bridge: https://docs.px4.io/main/en/ros2/user_guide.html
- The hardware-abstraction seam (`ISensorBackend`) — this is the actual architecture decision needed to answer "SPI or I2C or CAN?" from before: **that decision lives in a new backend class, not in the ROS node.**

**You must supply before this flies:**

1. **A real `ISensorBackend` implementation** for your chosen AE sensor's ADC and your ECU's CAN/DroneCAN interface. The `MockSensorBackend` in `sensor_sampler_node.cpp` shows exactly where this plugs in.
2. **`px4_msgs`** built in your workspace, version-matched to your PX4 firmware (`git clone https://github.com/PX4/px4_msgs` on the branch matching your PX4 version).
3. **The `MicroXRCEAgent`** running (bridges PX4's internal uORB topics to ROS 2 DDS) — install per PX4's ROS 2 user guide.
4. **A decision on closed-loop autonomy.** `px4_advisory_bridge.cpp` deliberately publishes advisories only — it does NOT command PX4 directly (no `VehicleCommand` publish). Wiring an actual RTL/divert command is ~10 lines but is a flight-safety decision your team should make and test in PX4 SITL simulation first, not something a code skeleton should silently enable.
5. **Cryptographic signing** for the black-box log topic — currently a plain CSV-string publish; the real "tamper-evident" claim from your dossiers needs HMAC/signing added before the log is trustworthy evidence.

## Build (once px4_msgs and ROS 2 are installed)

```bash
cd ros2_ws
colcon build --packages-select engine_health_monitor
source install/setup.bash
ros2 launch engine_health_monitor engine_monitor.launch.py
```

## Feeding the trained PyTorch model into this pipeline

The `EngineTelemetry.msg` fields intentionally match the `FEATURES` list
in `train_physics_pinn.py`. The missing piece (not included here, since
it depends on your chosen inference runtime) is a `rul_inference_node`
that:

1. Subscribes to `engine/telemetry`,
2. Runs the saved `physics_pinn.pt` (via LibTorch C++, or a Python
   rclpy node if C++ deployment isn't required for your demo),
3. Republishes the same message with `predicted_degradation_index`,
   `predicted_rul_cycles`, and `fault_flag` filled in.

For Jetson deployment, exporting the trained model to TensorRT (via
ONNX) will run substantially faster than raw PyTorch inference at the
edge.
