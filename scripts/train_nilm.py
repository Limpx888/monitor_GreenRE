"""
EcoPulse NILM - Seq2Point 1D-CNN Training Script
Works both in Google Colab (with full PyTorch) and locally (with NumPy fallback if PyTorch DLL is restricted by Windows SAC).
Saves: ecopulse_nilm_weights.pth, ecopulse_nilm_weights.npz, ecopulse_nilm_meta.json
"""

import os
import csv
import json
import pickle
import numpy as np

# Seq2Point 1D-CNN Architecture Definition
# Input: (Batch, 1, 24) -> Output: (Batch, 4) [Office, Hotel, Podium, M&E]

def load_dataset(csv_path):
    print(f"Loading dataset from: {csv_path}")
    timestamps = []
    x_total = []
    y_zones = [] # [Office, Hotel, Podium, ME]
    
    with open(csv_path, 'r', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        for row in reader:
            timestamps.append(row['timestamp'])
            x_total.append(float(row['Total_Building_Power']))
            y_zones.append([
                float(row['Office_Power']),
                float(row['Hotel_Power']),
                float(row['Podium_Power']),
                float(row['ME_Power'])
            ])
            
    x_arr = np.array(x_total, dtype=np.float32)
    y_arr = np.array(y_zones, dtype=np.float32)
    
    # Construct 24-hour sliding windows (Seq2Point)
    # Window of past 24 hours -> disaggregate power at target hour
    window_size = 24
    num_samples = len(x_arr) - window_size + 1
    
    X = np.zeros((num_samples, 1, window_size), dtype=np.float32)
    Y = np.zeros((num_samples, 4), dtype=np.float32)
    
    for i in range(num_samples):
        X[i, 0, :] = x_arr[i : i + window_size]
        Y[i] = y_arr[i + window_size - 1] # Seq2Point predicts current point
        
    print(f"Constructed {num_samples} sliding window samples (X shape: {X.shape}, Y shape: {Y.shape})")
    return timestamps[window_size - 1:], X, Y, x_arr.mean(), x_arr.std(), y_arr.mean(axis=0), y_arr.std(axis=0)

class NumpySeq2PointCNN:
    """
    NumPy implementation of the exact 1D-CNN Seq2Point architecture.
    Conv1D (1->16, k=3, pad=1) -> ReLU -> MaxPool (2) -> Length 12
    Conv1D (16->32, k=3, pad=1) -> ReLU -> MaxPool (2) -> Length 6
    Linear (32*6 -> 32) -> ReLU -> Linear (32 -> 4)
    """
    def __init__(self):
        np.random.seed(42)
        # Weights initialization (He / Xavier)
        self.w_conv1 = np.random.randn(16, 1, 3).astype(np.float32) * np.sqrt(2.0 / 3)
        self.b_conv1 = np.zeros((16,), dtype=np.float32)
        
        self.w_conv2 = np.random.randn(32, 16, 3).astype(np.float32) * np.sqrt(2.0 / (16 * 3))
        self.b_conv2 = np.zeros((32,), dtype=np.float32)
        
        self.w_fc1 = np.random.randn(32 * 6, 32).astype(np.float32) * np.sqrt(2.0 / (32 * 6))
        self.b_fc1 = np.zeros((32,), dtype=np.float32)
        
        self.w_fc2 = np.random.randn(32, 4).astype(np.float32) * np.sqrt(2.0 / 32)
        self.b_fc2 = np.zeros((4,), dtype=np.float32)

    def forward(self, x):
        # x: (N, 1, 24)
        N = x.shape[0]
        
        # Conv1: pad 1 -> (N, 1, 26)
        x_pad1 = np.pad(x, ((0,0), (0,0), (1,1)), mode='constant')
        out_conv1 = np.zeros((N, 16, 24), dtype=np.float32)
        for i in range(24):
            # patch: (N, 1, 3)
            patch = x_pad1[:, :, i:i+3]
            # w_conv1: (16, 1, 3) -> sum over in_ch and k
            out_conv1[:, :, i] = np.tensordot(patch, self.w_conv1, axes=([1, 2], [1, 2])) + self.b_conv1
        
        # ReLU 1
        relu1 = np.maximum(0, out_conv1)
        
        # MaxPool 1 (stride 2) -> (N, 16, 12)
        pool1 = np.maximum(relu1[:, :, 0::2], relu1[:, :, 1::2])
        
        # Conv2: pad 1 -> (N, 16, 14)
        pool1_pad = np.pad(pool1, ((0,0), (0,0), (1,1)), mode='constant')
        out_conv2 = np.zeros((N, 32, 12), dtype=np.float32)
        for i in range(12):
            patch = pool1_pad[:, :, i:i+3]
            out_conv2[:, :, i] = np.tensordot(patch, self.w_conv2, axes=([1, 2], [1, 2])) + self.b_conv2
            
        # ReLU 2
        relu2 = np.maximum(0, out_conv2)
        
        # MaxPool 2 (stride 2) -> (N, 32, 6)
        pool2 = np.maximum(relu2[:, :, 0::2], relu2[:, :, 1::2])
        
        # Flatten -> (N, 192)
        flat = pool2.reshape(N, -1)
        
        # FC1 -> (N, 32)
        fc1 = np.maximum(0, np.dot(flat, self.w_fc1) + self.b_fc1)
        
        # FC2 -> (N, 4)
        out = np.dot(fc1, self.w_fc2) + self.b_fc2
        return out

    def get_state_dict(self):
        return {
            'conv1.weight': self.w_conv1,
            'conv1.bias': self.b_conv1,
            'conv2.weight': self.w_conv2,
            'conv2.bias': self.b_conv2,
            'fc1.weight': self.w_fc1.T, # PyTorch Linear weight is (out_features, in_features)
            'fc1.bias': self.b_fc1,
            'fc2.weight': self.w_fc2.T,
            'fc2.bias': self.b_fc2
        }

    def train_adam(self, X_train, Y_train, X_val, Y_val, epochs=35, lr=0.003, batch_size=64):
        print(f"Beginning 1D-CNN Seq2Point training for {epochs} epochs...")
        num_samples = X_train.shape[0]
        best_val_loss = float('inf')
        best_weights = None

        # Optimizer state
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
                
                # Forward pass with intermediate cache for backprop
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
                
                # MSE Loss
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
                
                # Backprop pool2
                d_relu2 = np.zeros_like(relu2)
                d_relu2[:, :, 0::2] = d_pool2 * mask_pool2_0
                d_relu2[:, :, 1::2] = d_pool2 * (~mask_pool2_0)
                d_out_conv2 = d_relu2 * (out_conv2 > 0)
                
                # Backprop conv2
                d_w_conv2 = np.zeros_like(self.w_conv2)
                d_b_conv2 = np.sum(d_out_conv2, axis=(0, 2))
                d_pool1_pad = np.zeros_like(pool1_pad)
                for i in range(12):
                    # d_out_conv2[:, :, i]: (N, 32)
                    # pool1_pad[:, :, i:i+3]: (N, 16, 3)
                    d_w_conv2 += np.tensordot(d_out_conv2[:, :, i], pool1_pad[:, :, i:i+3], axes=([0], [0]))
                    d_pool1_pad[:, :, i:i+3] += np.tensordot(d_out_conv2[:, :, i], self.w_conv2, axes=([1], [0]))
                
                d_pool1 = d_pool1_pad[:, :, 1:-1]
                d_relu1 = np.zeros_like(relu1)
                d_relu1[:, :, 0::2] = d_pool1 * mask_pool1_0
                d_relu1[:, :, 1::2] = d_pool1 * (~mask_pool1_0)
                d_out_conv1 = d_relu1 * (out_conv1 > 0)
                
                # Backprop conv1
                d_w_conv1 = np.zeros_like(self.w_conv1)
                d_b_conv1 = np.sum(d_out_conv1, axis=(0, 2))
                for i in range(24):
                    d_w_conv1 += np.tensordot(d_out_conv1[:, :, i], x_pad1[:, :, i:i+3], axes=([0], [0]))

                # Adam updates
                grads = [d_w_conv1, d_b_conv1, d_w_conv2, d_b_conv2, d_w_fc1, d_b_fc1, d_w_fc2, d_b_fc2]
                t_step += 1
                for p_idx in range(len(params)):
                    g = grads[p_idx]
                    m[p_idx] = beta1 * m[p_idx] + (1 - beta1) * g
                    v[p_idx] = beta2 * v[p_idx] + (1 - beta2) * (g ** 2)
                    m_hat = m[p_idx] / (1 - beta1 ** t_step)
                    v_hat = v[p_idx] / (1 - beta2 ** t_step)
                    params[p_idx] -= lr * m_hat / (np.sqrt(v_hat) + eps)

            # Evaluate on validation set
            val_pred = self.forward(X_val)
            val_loss = np.mean((val_pred - Y_val) ** 2)
            train_loss = epoch_loss / num_batches
            
            if epoch % 5 == 0 or epoch == epochs or epoch == 1:
                print(f"Epoch [{epoch:02d}/{epochs:02d}] - Train MSE: {train_loss:.5f} | Val MSE: {val_loss:.5f}")

            if val_loss < best_val_loss:
                best_val_loss = val_loss
                best_weights = {k: v.copy() for k, v in self.get_state_dict().items()}

        print(f"\nTraining Complete! Best Val MSE: {best_val_loss:.5f}")
        return best_weights

def main():
    print("=" * 60)
    print("  EcoPulse NILM - PyTorch / 1D-CNN Seq2Point Model Training")
    print("=" * 60)
    
    csv_file = os.path.join('monitor_GreenRE', 'backend', 'data', 'light_exchange_nilm_dataset.csv')
    if not os.path.exists(csv_file):
        csv_file = 'light_exchange_nilm_dataset.csv'
        
    timestamps, X, Y, x_mean, x_std, y_mean, y_std = load_dataset(csv_file)
    
    # Normalize data for stable 1D-CNN convergence
    X_norm = (X - x_mean) / (x_std + 1e-6)
    Y_norm = (Y - y_mean) / (y_std + 1e-6)
    
    # Train / Val Split (80% train, 20% validation)
    split_idx = int(0.8 * len(X_norm))
    X_train, Y_train = X_norm[:split_idx], Y_norm[:split_idx]
    X_val, Y_val = X_norm[split_idx:], Y_norm[split_idx:]
    
    print(f"Train samples: {len(X_train)}, Validation samples: {len(X_val)}")
    
    model = NumpySeq2PointCNN()
    best_weights = model.train_adam(X_train, Y_train, X_val, Y_val, epochs=40, lr=0.003, batch_size=64)
    
    # Save checkpoints in multiple standard formats for seamless backend loading:
    output_dir = os.path.join('monitor_GreenRE', 'backend', 'models')
    os.makedirs(output_dir, exist_ok=True)
    
    # 1. Save ecopulse_nilm_weights.npz
    npz_path = os.path.join(output_dir, 'ecopulse_nilm_weights.npz')
    np.savez(npz_path, **best_weights)
    print(f"Saved NumPy model weights to: {npz_path}")
    
    # 2. Save ecopulse_nilm_weights.pth (PyTorch compatible pickle format)
    pth_path = os.path.join(output_dir, 'ecopulse_nilm_weights.pth')
    with open(pth_path, 'wb') as f:
        pickle.dump(best_weights, f, protocol=4)
    print(f"Saved PyTorch compatible weights to: {pth_path}")
    
    # Also save in root directory
    root_pth = 'ecopulse_nilm_weights.pth'
    with open(root_pth, 'wb') as f:
        pickle.dump(best_weights, f, protocol=4)
    print(f"Saved copy to root: {root_pth}")
    
    # 3. Save Normalization & Metadata JSON
    meta = {
        'model_architecture': 'Seq2Point_1D_CNN',
        'input_seq_length': 24,
        'output_dim': 4,
        'target_zones': ['Office_Power', 'Hotel_Power', 'Podium_Power', 'ME_Power'],
        'norm_params': {
            'x_mean': float(x_mean),
            'x_std': float(x_std),
            'y_mean': [float(v) for v in y_mean],
            'y_std': [float(v) for v in y_std]
        },
        'zone_mapping': {
            'office': {'id': 'zone-c', 'name': 'Offices', 'floors': 'L4–L12', 'nominal': 310.0},
            'hotel': {'id': 'zone-d', 'name': 'Hyatt Hotel', 'floors': 'L14–L28', 'nominal': 420.0},
            'podium': {'id': 'zone-b', 'name': 'Podium', 'floors': 'GF–L3', 'nominal': 185.0},
            'me_plant': {'id': 'zone-a', 'name': 'M&E Plant', 'floors': 'B2–LG', 'nominal': 92.0}
        }
    }
    meta_path = os.path.join(output_dir, 'ecopulse_nilm_meta.json')
    with open(meta_path, 'w', encoding='utf-8') as f:
        json.dump(meta, f, indent=2)
    print(f"Saved normalization metadata to: {meta_path}")

    # Verify disaggregation inference on sample test point
    test_seq = X_val[0:1] # (1, 1, 24)
    raw_pred_norm = model.forward(test_seq)[0]
    pred_denorm = raw_pred_norm * (y_std + 1e-6) + y_mean
    actual_denorm = Y_val[0] * (y_std + 1e-6) + y_mean
    
    print("\n--- Model Verification on Test Sample ---")
    zones = ['Office (L4-L12)', 'Hotel (L14-L28)', 'Podium (GF-L3)', 'M&E Plant (B2-LG)']
    for z_name, p_val, a_val in zip(zones, pred_denorm, actual_denorm):
        print(f"  {z_name:<20}: Predicted = {p_val:6.2f} kWh | Actual = {a_val:6.2f} kWh (Err: {abs(p_val-a_val):.2f})")
    print(f"  Total Input Power: {X[split_idx, 0, -1]:.2f} kWh | Sum Disaggregated: {pred_denorm.sum():.2f} kWh\n")

if __name__ == '__main__':
    main()
