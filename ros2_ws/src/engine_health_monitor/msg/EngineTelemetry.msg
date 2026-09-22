# EngineTelemetry.msg
# Matches the FEATURES columns in generate_rtf_dataset.py / train_rul_pinn.py
# so the same downstream PyTorch model can consume live ROS 2 data.

std_msgs/Header header

float32 altitude_ft
float32 air_density_kgm3
float32 rpm
float32 throttle_pct
float32 cht_C
float32 egt_C
float32 oil_press_kPa
float32 oil_temp_C
float32 fuel_flow_kgph
float32 vibration_rms_g
float32 ae_energy_20k_1M_band
float32 alternator_ripple_mV

# Digital-twin outputs, filled in by the inference node (initially zero
# from the raw sampler)
float32 predicted_degradation_index
float32 predicted_rul_cycles
bool    fault_flag
string  fault_class
