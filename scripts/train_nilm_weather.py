"""
Phase 2: EcoPulseNILM_Weather (2-Channel 1D-CNN) Training Script
Input: (Batch, 2, 24)
  Channel 0: Total_Building_Power (past 24h)
  Channel 1: Outdoor airTemperature (past 24h)
Output: (Batch, 4) [Office, Hotel, Podium, M&E Plant]
"""

import os
import csv
import json
import pickle
import numpy as np

def load_2channel_dataset(csv_path):
    print(f"Loading 2-Channel dataset from: {csv_path}")
    timestamps = []
    x_power = []
    x_temp = []
    y_zones = []
    
    with open(csv_path, 'r', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        for row in reader:
            timestamps.append(row['timestamp'])
            x_power.append(float(row['Total_Building_Power']))
            x_temp.append(float(row['airTemperature']))
            y_zones.append([
                float(row['Office_Power']),
                float(row['Hotel_Power']),
                float(row['Podium_Power']),
                float(row['ME_Power'])
            ])
            
    p_arr = np.array(x_power, dtype=np.float32)
    t_arr = np.array(x_temp, dtype=np.float32)
    y_arr = np.array(y_zones, dtype=np.float32)
    
    window_size = 24
    num_samples = len(p_arr) - window_size + 1
    
    # 2 Channels: (N, 2, 24)
    X = np.zeros((num_samples, 2, window_size), dtype=np.float32)
    Y = np.zeros((num_samples, 4), dtype=np.float32)
    
    for i in range(num_samples):
        X[i, 0, :] = p_arr[i : i + window_size]  # Channel 0: Power
        X[i, 1, :] = t_arr[i : i + window_size]  # Channel 1: Temperature
        Y[i] = y_arr[i + window_size - 1]
        
    p_mean, p_std = p_arr.mean(), p_arr.std()
    t_mean, t_std = t_arr.mean(), t_arr.std()
    y_mean, y_std = y_arr.mean(axis=0), y_arr.std(axis=0)

    print(f"Constructed 2-Channel dataset: X={X.shape}, Y={Y.shape}")
    print(f"  Power: Mean={p_mean:.1f} kW, Std={p_std:.1f}")
    print(f"  Temp:  Mean={t_mean:.1f} °C, Std={t_std:.1f}")
    return timestamps[window_size - 1:], X, Y, p_mean, p_std, t_mean, t_std, y_mean, y_std

class Numpy2Channel1DCNN:
    """
    2-Channel 1D-CNN Seq2Point architecture (EcoPulseNILM_Weather)
    Conv1D (in=2, out=16, k=3, pad=1) -> ReLU -> MaxPool (2) -> Length 12
    Conv1D (in=16, out=32, k=3, pad=1) -> ReLU -> MaxPool (2) -> Length 6
    Linear (192 -> 32) -> ReLU -> Linear (32 -> 4)
    """
    def __init__(self):
        np.random.seed(42)
        # in_channels = 2
        self.w_conv1 = np.random.randn(16, 2, 3).astype(np.float32) * np.sqrt(2.0 / (2 * 3))
        self.b_conv1 = np.zeros((16,), dtype=np.float32)
        
        self.w_conv2 = np.random.randn(32, 16, 3).astype(np.float32) * np.sqrt(2.0 / (16 * 3))
        self.b_conv2 = np.zeros((32,), dtype=np.float32)
        
        self.w_fc1 = np.random.randn(32 * 6, 32).astype(np.float32) * np.sqrt(2.0 / (32 * 6))
        self.b_fc1 = np.zeros((32,), dtype=np.float32)
        
        self.w_fc2 = np.random.randn(32, 4).astype(np.float32) * np.sqrt(2.0 / 32)
        self.b_fc2 = np.zeros((4,), dtype=np.float32)

    def forward(self, x):
        # x: (N, 2, 24)
        N = x.shape[0]
        
        # Conv1: pad 1 on time axis -> (N, 2, 26)
        x_pad1 = np.pad(x, ((0,0), (0,0), (1,1)), mode='constant')
        out_conv1 = np.zeros((N, 16, 24), dtype=np.float32)
        for i in range(24):
            patch = x_pad1[:, :, i:i+3] # (N, 2, 3)
            out_conv1[:, :, i] = np.tensordot(patch, self.w_conv1, axes=([1, 2], [1, 2])) + self.b_conv1
        
        relu1 = np.maximum(0, out_conv1)
        pool1 = np.maximum(relu1[:, :, 0::2], relu1[:, :, 1::2]) # (N, 16, 12)
        
        # Conv2
        pool1_pad = np.pad(pool1, ((0,0), (0,0), (1,1)), mode='constant')
        out_conv2 = np.zeros((N, 32, 12), dtype=np.float32)
        for i in range(12):
            patch = pool1_pad[:, :, i:i+3] # (N, 16, 3)
            out_conv2[:, :, i] = np.tensordot(patch, self.w_conv2, axes=([1, 2], [1, 2])) + self.b_conv2
            
        relu2 = np.maximum(0, out_conv2)
        pool2 = np.maximum(relu2[:, :, 0::2], relu2[:, :, 1::2]) # (N, 32, 6)
        
        flat = pool2.reshape(N, -1)
        fc1 = np.maximum(0, np.dot(flat, self.w_fc1) + self.b_fc1)
        out = np.dot(fc1, self.w_fc2) + self.b_fc2
        return out

    def get_state_dict(self):
        return {
            'conv1.weight': self.w_conv1,
            'conv1.bias': self.b_conv1,
            'conv2.weight': self.w_conv2,
            'conv2.bias': self.b_conv2,
            'fc1.weight': self.w_fc1.T,
            'fc1.bias': self.b_fc1,
            'fc2.weight': self.w_fc2.T,
            'fc2.bias': self.b_fc2
        }

    def train_adam(self, X_train, Y_train, X_val, Y_val, epochs=40, lr=0.003, batch_size=64):
        print(f"Training EcoPulseNILM_Weather (2-Channel 1D-CNN) for {epochs} epochs...")
        num_samples = X_train.shape[0]
        best_val_loss = float('inf')
        best_weights = None

        params = [self.w_conv1, self.b_conv1, self.w_conv2, self.b_conv2, self.w_fc1, self.b_fc1, self.w_fc2, self.b_fc2]
        m = [np.zeros_like(p) for p in params]
        v = [np.zeros_like(p) for p in params]
        beta1, beta2, eps = 0.9, 0.999, 1e-8
        t_step = 0

        for epoch in range(1, epochs + 1):
            perm = np.random.permutation(num_samples)
            epoch_loss = 0.0
            num_batches = 0

            for b in range(0, num_samples, batch_size):
                idx = perm[b : b + batch_size]
                bx = X_train[idx]
                by = Y_train[idx]
                N = bx.shape[0]
                
                # Forward pass
                x_pad1 = np.pad(bx, ((0,0), (0,0), (1,1)), mode='constant')
                out_conv1 = np.zeros((N, 16, 24), dtype=np.float32)
                for i in range(24):
                    out_conv1[:, :, i] = np.tensordot(x_pad1[:, :, i:i+3], self.w_conv1, axes=([1, 2], [1, 2])) + self.b_conv1
                relu1 = np.maximum(0, out_conv1)
                
                pool1 = np.maximum(relu1[:, :, 0::2], relu1[:, :, 1::2])
                mask_pool1_0 = (relu1[:, :, 0::2] >= relu1[:, :, 1::2])
                
                pool1_pad = np.pad(pool1, ((0,0), (0,0), (1,1)), mode='constant')
                out_conv2 = np.zeros((N, 32, 12), dtype=np.float32)
                for i in range(12):
                    out_conv2[:, :, i] = np.tensordot(pool1_pad[:, :, i:i+3], self.w_conv2, axes=([1, 2], [1, 2])) + self.b_conv2
                relu2 = np.maximum(0, out_conv2)
                
                pool2 = np.maximum(relu2[:, :, 0::2], relu2[:, :, 1::2])
                mask_pool2_0 = (relu2[:, :, 0::2] >= relu2[:, :, 1::2])
                
                flat = pool2.reshape(N, -1)
                z_fc1 = np.dot(flat, self.w_fc1) + self.b_fc1
                a_fc1 = np.maximum(0, z_fc1)
                pred = np.dot(a_fc1, self.w_fc2) + self.b_fc2
                
                diff = pred - by
                loss = np.mean(diff ** 2)
                epoch_loss += loss
                num_batches += 1

                # Backward pass
                d_pred = 2.0 * diff / (N * 4.0)
                d_w_fc2 = np.dot(a_fc1.T, d_pred)
                d_b_fc2 = np.sum(d_pred, axis=0)
                
                d_a_fc1 = np.dot(d_pred, self.w_fc2.T)
                d_z_fc1 = d_a_fc1 * (z_fc1 > 0)
                d_w_fc1 = np.dot(flat.T, d_z_fc1)
                d_b_fc1 = np.sum(d_z_fc1, axis=0)
                
                d_flat = np.dot(d_z_fc1, self.w_fc1.T)
                d_pool2 = d_flat.reshape(pool2.shape)
                
                d_relu2 = np.zeros_like(relu2)
                d_relu2[:, :, 0::2] = d_pool2 * mask_pool2_0
                d_relu2[:, :, 1::2] = d_pool2 * (~mask_pool2_0)
                d_out_conv2 = d_relu2 * (out_conv2 > 0)
                
                d_w_conv2 = np.zeros_like(self.w_conv2)
                d_b_conv2 = np.sum(d_out_conv2, axis=(0, 2))
                d_pool1_pad = np.zeros_like(pool1_pad)
                for i in range(12):
                    d_w_conv2 += np.tensordot(d_out_conv2[:, :, i], pool1_pad[:, :, i:i+3], axes=([0], [0]))
                    d_pool1_pad[:, :, i:i+3] += np.tensordot(d_out_conv2[:, :, i], self.w_conv2, axes=([1], [0]))
                
                d_pool1 = d_pool1_pad[:, :, 1:-1]
                d_relu1 = np.zeros_like(relu1)
                d_relu1[:, :, 0::2] = d_pool1 * mask_pool1_0
                d_relu1[:, :, 1::2] = d_pool1 * (~mask_pool1_0)
                d_out_conv1 = d_relu1 * (out_conv1 > 0)
                
                d_w_conv1 = np.zeros_like(self.w_conv1)
                d_b_conv1 = np.sum(d_out_conv1, axis=(0, 2))
                for i in range(24):
                    # d_out_conv1[:, :, i]: (N, 16)
                    # x_pad1[:, :, i:i+3]: (N, 2, 3)
                    d_w_conv1 += np.tensordot(d_out_conv1[:, :, i], x_pad1[:, :, i:i+3], axes=([0], [0]))

                # Adam step
                grads = [d_w_conv1, d_b_conv1, d_w_conv2, d_b_conv2, d_w_fc1, d_b_fc1, d_w_fc2, d_b_fc2]
                t_step += 1
                for p_idx in range(len(params)):
                    g = grads[p_idx]
                    m[p_idx] = beta1 * m[p_idx] + (1 - beta1) * g
                    v[p_idx] = beta2 * v[p_idx] + (1 - beta2) * (g ** 2)
                    m_hat = m[p_idx] / (1 - beta1 ** t_step)
                    v_hat = v[p_idx] / (1 - beta2 ** t_step)
                    params[p_idx] -= lr * m_hat / (np.sqrt(v_hat) + eps)

            val_pred = self.forward(X_val)
            val_loss = np.mean((val_pred - Y_val) ** 2)
            train_loss = epoch_loss / num_batches
            
            if epoch % 5 == 0 or epoch == epochs or epoch == 1:
                print(f"Epoch [{epoch:02d}/{epochs:02d}] - Train MSE: {train_loss:.5f} | Val MSE: {val_loss:.5f}")

            if val_loss < best_val_loss:
                best_val_loss = val_loss
                best_weights = {k: v.copy() for k, v in self.get_state_dict().items()}

        print(f"\n2-Channel Training Complete! Best Val MSE: {best_val_loss:.5f}")
        return best_weights

def main():
    print("=" * 65)
    print("  Phase 2: PyTorch 2-Channel 1D-CNN (EcoPulseNILM_Weather) Training")
    print("=" * 65)
    
    csv_file = os.path.join('monitor_GreenRE', 'backend', 'data', 'light_exchange_nilm_weather_dataset.csv')
    if not os.path.exists(csv_file):
        csv_file = 'light_exchange_nilm_weather_dataset.csv'
        
    timestamps, X, Y, p_mean, p_std, t_mean, t_std, y_mean, y_std = load_2channel_dataset(csv_file)
    
    # Normalize channels
    X_norm = np.zeros_like(X)
    X_norm[:, 0, :] = (X[:, 0, :] - p_mean) / (p_std + 1e-6)
    X_norm[:, 1, :] = (X[:, 1, :] - t_mean) / (t_std + 1e-6)
    Y_norm = (Y - y_mean) / (y_std + 1e-6)
    
    split_idx = int(0.8 * len(X_norm))
    X_train, Y_train = X_norm[:split_idx], Y_norm[:split_idx]
    X_val, Y_val = X_norm[split_idx:], Y_norm[split_idx:]
    
    model = Numpy2Channel1DCNN()
    best_weights = model.train_adam(X_train, Y_train, X_val, Y_val, epochs=40, lr=0.003, batch_size=64)
    
    output_dir = os.path.join('monitor_GreenRE', 'backend', 'models')
    os.makedirs(output_dir, exist_ok=True)
    
    # Save NPZ & PTH
    npz_path = os.path.join(output_dir, 'ecopulse_nilm_weather_weights.npz')
    np.savez(npz_path, **best_weights)
    print(f"Saved 2-channel weights: {npz_path}")
    
    pth_path = os.path.join(output_dir, 'ecopulse_nilm_weather_weights.pth')
    with open(pth_path, 'wb') as f:
        pickle.dump(best_weights, f, protocol=4)
    print(f"Saved PyTorch compatible 2-channel weights: {pth_path}")
    
    root_pth = 'ecopulse_nilm_weather_weights.pth'
    with open(root_pth, 'wb') as f:
        pickle.dump(best_weights, f, protocol=4)
        
    # Metadata JSON
    meta = {
        'model_architecture': 'EcoPulseNILM_Weather_2Channel_1D_CNN',
        'input_channels': 2,
        'channels': ['Total_Building_Power', 'airTemperature'],
        'input_seq_length': 24,
        'output_dim': 4,
        'target_zones': ['Office_Power', 'Hotel_Power', 'Podium_Power', 'ME_Power'],
        'norm_params': {
            'power_mean': float(p_mean),
            'power_std': float(p_std),
            'temp_mean': float(t_mean),
            'temp_std': float(t_std),
            'y_mean': [float(v) for v in y_mean],
            'y_std': [float(v) for v in y_std]
        }
    }
    meta_path = os.path.join(output_dir, 'ecopulse_nilm_weather_meta.json')
    with open(meta_path, 'w', encoding='utf-8') as f:
        json.dump(meta, f, indent=2)
    print(f"Saved 2-channel metadata: {meta_path}")

    # Evaluate validation sample
    test_seq = X_val[0:1]
    raw_pred_norm = model.forward(test_seq)[0]
    pred_denorm = raw_pred_norm * (y_std + 1e-6) + y_mean
    actual_denorm = Y_val[0] * (y_std + 1e-6) + y_mean
    
    print("\n--- Model Verification on 2-Channel Test Sample ---")
    zones = ['Office (L4-L12)', 'Hotel (L14-L28)', 'Podium (GF-L3)', 'M&E Plant (B2-LG)']
    for z_name, p_val, a_val in zip(zones, pred_denorm, actual_denorm):
        print(f"  {z_name:<20}: Predicted = {p_val:6.2f} kWh | Actual = {a_val:6.2f} kWh (Err: {abs(p_val-a_val):.2f})")
    print(f"  Outdoor Temp: {X[split_idx, 1, -1]:.1f} °C | Total Power: {X[split_idx, 0, -1]:.1f} kW | Sum Disaggregated: {pred_denorm.sum():.1f} kW\n")

if __name__ == '__main__':
    main()
