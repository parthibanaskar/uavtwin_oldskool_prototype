content = open('edge-server/python/main.py', 'r').read()

target = 'da *= (1.0 + max(0.0, D_pred.item() * 1.5))'

new_code = '''da *= (1.0 + max(0.0, D_pred.item() * 1.5))
        elif self.numpy_model is not None and features_dict is not None:
            import numpy as np
            feature_names = ["altitude_ft", "air_density_kgm3", "rpm", "throttle_pct", "cht_C", "egt_C", "oil_press_kPa", "oil_temp_C", "fuel_flow_kgph", "bsfc_g_per_kWh", "vibration_rms_g", "ae_energy_20k_1M_band", "alternator_ripple_mV"]
            x = [features_dict.get(n, 0.0) for n in feature_names]
            x_norm = (np.array(x, dtype=np.float32) - self.feature_mean) / self.feature_std
            
            nm = self.numpy_model
            h = np.tanh(x_norm @ nm['w0'] + nm['b0'])
            h = np.tanh(h @ nm['w2'] + nm['b2'])
            h = np.tanh(h @ nm['w4'] + nm['b4'])
            D_pred = np.log1p(np.exp(h @ nm['wd'] + nm['bd'])) # softplus
            
            da *= (1.0 + max(0.0, D_pred.item() * 1.5))'''

if target in content:
    content = content.replace(target, new_code, 1)
    open('edge-server/python/main.py', 'w').write(content)
    print('Modified successfully')
else:
    print('Target not found')
