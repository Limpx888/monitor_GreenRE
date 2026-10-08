"""
EcoPulseNILM_Weather - PyTorch 2-Channel 1D-CNN Training Script (Google Colab Ready)
In_Channels=2:
  Channel 0: Total_Building_Power (past 24h)
  Channel 1: Outdoor airTemperature (past 24h)
Output: 4 neurons [Office, Hotel, Podium, M&E Plant]
"""

import os
import argparse
import pandas as pd
import numpy as np

try:
    import torch
    import torch.nn as nn
    from torch.utils.data import Dataset, DataLoader
except ImportError:
    torch = None

class EcoPulseNILM_Weather(nn.Module if torch else object):
    def __init__(self, in_channels=2):
        super().__init__()
        self.conv_net = nn.Sequential(
            nn.Conv1d(in_channels=in_channels, out_channels=16, kernel_size=3, padding=1),
            nn.ReLU(),
            nn.MaxPool1d(kernel_size=2),  # 24 -> 12
            nn.Conv1d(in_channels=16, out_channels=32, kernel_size=3, padding=1),
            nn.ReLU(),
            nn.MaxPool1d(kernel_size=2),  # 12 -> 6
            nn.Flatten(),
            nn.Linear(32 * 6, 32),
            nn.ReLU(),
            nn.Linear(32, 4)  # 4 neurons: [Office, Hotel, Podium, M&E]
        )

    def forward(self, x):
        return self.conv_net(x)

if torch:
    class WeatherNILMDataset(Dataset):
        def __init__(self, X, Y):
            self.X = torch.tensor(X, dtype=torch.float32)
            self.Y = torch.tensor(Y, dtype=torch.float32)

        def __len__(self):
            return len(self.X)

        def __getitem__(self, idx):
            return self.X[idx], self.Y[idx]

def train():
    parser = argparse.ArgumentParser()
    parser.add_argument('--csv', default='light_exchange_nilm_weather_dataset.csv', help='Path to dataset')
    parser.add_argument('--epochs', type=int, default=40, help='Number of epochs')
    parser.add_argument('--batch_size', type=int, default=64, help='Batch size')
    parser.add_argument('--lr', type=float, default=0.002, help='Learning rate')
    parser.add_argument('--output', default='ecopulse_nilm_weather_weights.pth', help='Output weight file')
    args = parser.parse_args()

    if not torch:
        print("PyTorch not installed in this environment. Use scripts/train_nilm_weather.py for universal training.")
        return

    device = torch.device('cuda' if torch.cuda.is_available() else 'cpu')
    print(f"Using device: {device}")

    df = pd.read_csv(args.csv)
    p_total = df['Total_Building_Power'].values
    t_temp = df['airTemperature'].values
    y_zones = df[['Office_Power', 'Hotel_Power', 'Podium_Power', 'ME_Power']].values

    p_mean, p_std = p_total.mean(), p_total.std()
    t_mean, t_std = t_temp.mean(), t_temp.std()
    y_mean, y_std = y_zones.mean(axis=0), y_zones.std(axis=0)

    p_norm = (p_total - p_mean) / (p_std + 1e-6)
    t_norm = (t_temp - t_mean) / (t_std + 1e-6)
    y_norm = (y_zones - y_mean) / (y_std + 1e-6)

    window_size = 24
    num_samples = len(p_norm) - window_size + 1
    X = np.zeros((num_samples, 2, window_size), dtype=np.float32)
    Y = np.zeros((num_samples, 4), dtype=np.float32)

    for i in range(num_samples):
        X[i, 0, :] = p_norm[i : i + window_size]
        X[i, 1, :] = t_norm[i : i + window_size]
        Y[i] = y_norm[i + window_size - 1]

    split = int(0.8 * num_samples)
    train_loader = DataLoader(WeatherNILMDataset(X[:split], Y[:split]), batch_size=args.batch_size, shuffle=True)
    val_loader = DataLoader(WeatherNILMDataset(X[split:], Y[split:]), batch_size=args.batch_size, shuffle=False)

    model = EcoPulseNILM_Weather(in_channels=2).to(device)
    criterion = nn.MSELoss()
    optimizer = torch.optim.Adam(model.parameters(), lr=args.lr)

    print(f"Training EcoPulseNILM_Weather on {len(X[:split])} samples for {args.epochs} epochs...")
    best_loss = float('inf')

    for epoch in range(1, args.epochs + 1):
        model.train()
        train_loss = 0.0
        for batch_x, batch_y in train_loader:
            batch_x, batch_y = batch_x.to(device), batch_y.to(device)
            optimizer.zero_grad()
            out = model(batch_x)
            loss = criterion(out, batch_y)
            loss.backward()
            optimizer.step()
            train_loss += loss.item() * len(batch_x)

        train_loss /= len(X[:split])

        model.eval()
        val_loss = 0.0
        with torch.no_grad():
            for batch_x, batch_y in val_loader:
                batch_x, batch_y = batch_x.to(device), batch_y.to(device)
                out = model(batch_x)
                val_loss += criterion(out, batch_y).item() * len(batch_x)
        val_loss /= len(X[split:])

        if epoch % 5 == 0 or epoch == args.epochs:
            print(f"Epoch [{epoch:02d}/{args.epochs:02d}] Train MSE: {train_loss:.5f} | Val MSE: {val_loss:.5f}")

        if val_loss < best_loss:
            best_loss = val_loss
            torch.save(model.state_dict(), args.output)

    print(f"Finished training! Best weights saved to: {args.output}")

if __name__ == '__main__':
    train()
