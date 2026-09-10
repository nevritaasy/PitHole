import serial
import csv
import time
import os
import math
import pandas as pd
import matplotlib
matplotlib.use('Qt5Agg')  # Pastikan PyQt5 sudah terinstal
import matplotlib.pyplot as plt
from mpl_toolkits.mplot3d import Axes3D
from collections import deque

# ==================== KONFIGURASI ====================
COM_PORT = 'COM4'         # <--- UBAH SESUAI PORT KAMU
BAUD_RATE = 115200        # Sesuai dengan konfigurasi di STM32
waktu_run = time.strftime("%Y-%m-%d_%H-%M-%S")
CSV_FILENAME = f'data_sensor_mpu6050_{waktu_run}.csv'
GRAPH_FILENAME = f'grafik_mpu6050_{waktu_run}.png'
MAX_DISPLAY_POINTS = 100  # Jumlah poin data yang bergeser di layar (Real-time)
# =====================================================

def rotate_points(x, y, z, roll, pitch):
    """ Fungsi untuk memutar koordinat 3D berdasarkan sudut Roll dan Pitch """
    # Rotasi Pitch (terhadap sumbu X)
    y1 = y * math.cos(pitch) - z * math.sin(pitch)
    z1 = y * math.sin(pitch) + z * math.cos(pitch)
    x1 = x
    
    # Rotasi Roll (terhadap sumbu Y)
    x2 = x1 * math.cos(roll) + z1 * math.sin(roll)
    y2 = y1
    z2 = -x1 * math.sin(roll) + z1 * math.cos(roll)
    return x2, y2, z2

def main():
    print(f"[*] Mencoba membuka port {COM_PORT}...")
    try:
        ser = serial.Serial(COM_PORT, BAUD_RATE, timeout=1)
        time.sleep(2) # Jeda stabilitas serial
        print(f"[+] Berhasil terhubung ke {COM_PORT}!")
    except Exception as e:
        print(f"[X] Gagal membuka port! Error: {e}")
        return

    # Inisialisasi struktur data untuk real-time plot
    t_data = deque(maxlen=MAX_DISPLAY_POINTS)
    ax_data = deque(maxlen=MAX_DISPLAY_POINTS)
    ay_data = deque(maxlen=MAX_DISPLAY_POINTS)
    az_data = deque(maxlen=MAX_DISPLAY_POINTS)
    gx_data = deque(maxlen=MAX_DISPLAY_POINTS)
    gy_data = deque(maxlen=MAX_DISPLAY_POINTS)
    gz_data = deque(maxlen=MAX_DISPLAY_POINTS)

    # Set up Matplotlib Layout (Gunakan GridSpec untuk memisahkan 2D dan 3D)
    plt.ion()
    fig = plt.figure(figsize=(16, 9))
    gs = fig.add_gridspec(2, 2, width_ratios=[1.2, 1])
    
    # Grafik 2D (Sisi Kiri)
    ax1 = fig.add_subplot(gs[0, 0])
    ax2 = fig.add_subplot(gs[1, 0], sharex=ax1)
    
    # Grafik 3D (Sisi Kanan)
    ax3 = fig.add_subplot(gs[:, 1], projection='3d')
    
    # Inisialisasi objek garis kosong (2D)
    line_ax, = ax1.plot([], [], 'r-', label='Accel X', linewidth=1.5)
    line_ay, = ax1.plot([], [], 'g-', label='Accel Y', linewidth=1.5)
    line_az, = ax1.plot([], [], 'b-', label='Accel Z', linewidth=1.5)
    
    line_gx, = ax2.plot([], [], 'orange', label='Gyro X', linewidth=1.5)
    line_gy, = ax2.plot([], [], 'purple', label='Gyro Y', linewidth=1.5)
    line_gz, = ax2.plot([], [], 'cyan', label='Gyro Z', linewidth=1.5)

    # Inisialisasi objek 3D (Kerangka Sepeda Sederhana)
    line_3d_frame, = ax3.plot([], [], [], 'b-', linewidth=4, label='Rangka Sepeda')
    line_3d_handle, = ax3.plot([], [], [], 'r-', linewidth=3, label='Stang')

    # Kosmetik Grafik 2D
    ax1.set_title('Real-Time Akselerometer', fontsize=11, fontweight='bold')
    ax1.set_ylabel('Nilai Akselerasi (LSB)')
    ax1.grid(True, linestyle='--', alpha=0.5)
    ax1.legend(loc='upper right')

    ax2.set_title('Real-Time Giroskop', fontsize=11, fontweight='bold')
    ax2.set_xlabel('Waktu Relatif (Detik)')
    ax2.set_ylabel('Kecepatan Sudut (LSB)')
    ax2.grid(True, linestyle='--', alpha=0.5)
    ax2.legend(loc='upper right')
    
    # Kosmetik Grafik 3D
    ax3.set_title('Visualisasi Orientasi 3D Sepeda', fontsize=13, fontweight='bold')
    ax3.set_xlim([-1, 1])
    ax3.set_ylim([-1, 1])
    ax3.set_zlim([-1, 1])
    ax3.set_xlabel('Kiri (-) / Kanan (+)')
    ax3.set_ylabel('Belakang (-) / Depan (+)')
    ax3.set_zlabel('Bawah (-) / Atas (+)')
    # Mengatur sudut pandang kamera awal agar terlihat seperti melihat sepeda dari serong belakang
    ax3.view_init(elev=20, azim=-60) 
    
    plt.tight_layout()

    start_time = None
    update_counter = 0
    last_line = ""
    freeze_counter = 0

    print("\n[*] Mulai mengambil data... Tekan CTRL+C di Terminal untuk BERHENTI.")
    print("-" * 80)

    try:
        with open(CSV_FILENAME, mode='w', newline='') as file:
            writer = csv.writer(file)
            writer.writerow(['Timestamp', 'Accel_X', 'Accel_Y', 'Accel_Z', 'Suhu', 'Gyro_X', 'Gyro_Y', 'Gyro_Z'])

            while True:
                if ser.in_waiting > 0:
                    line = ser.readline().decode('utf-8', errors='ignore').strip()
                    
                    if "Siap" in line or not line:
                        continue
                    
                    if line == last_line:
                        freeze_counter += 1
                        if freeze_counter == 30:
                            print("\n[!] PERINGATAN: Sensor MPU6050 freeze!")
                    else:
                        freeze_counter = 0
                        last_line = line
                    
                    try:
                        data_split = line.split(',')
                        if len(data_split) == 7:
                            now = time.time()
                            if start_time is None:
                                start_time = now
                            
                            rel_time = now - start_time
                            
                            ax = int(data_split[0])
                            ay = int(data_split[1])
                            az = int(data_split[2])
                            suhu = int(data_split[3]) 
                            gx = int(data_split[4])
                            gy = int(data_split[5])
                            gz = int(data_split[6])

                            # 1. Simpan ke CSV
                            writer.writerow([now, ax, ay, az, suhu, gx, gy, gz])

                            # 2. Masukkan ke buffer grafik 2D
                            t_data.append(rel_time)
                            ax_data.append(ax)
                            ay_data.append(ay)
                            az_data.append(az)
                            gx_data.append(gx)
                            gy_data.append(gy)
                            gz_data.append(gz)

                            # 3. Hitung Sudut Kemiringan untuk 3D (Konversi ke Radian)
                            # Menggunakan data akselerometer untuk kalkulasi kemiringan statis terhadap gravitasi
                            roll = math.atan2(ay, az)
                            pitch = math.atan2(-ax, math.sqrt(ay**2 + az**2))

                            # 4. Update grafik berkala
                            update_counter += 1
                            if update_counter % 3 == 0:
                                # Update data garis 2D
                                line_ax.set_data(t_data, ax_data)
                                line_ay.set_data(t_data, ay_data)
                                line_az.set_data(t_data, az_data)
                                line_gx.set_data(t_data, gx_data)
                                line_gy.set_data(t_data, gy_data)
                                line_gz.set_data(t_data, gz_data)

                                ax1.relim()
                                ax1.autoscale_view()
                                ax2.relim()
                                ax2.autoscale_view()
                                
                                # --- UPDATE MODEL KENDARAAN 3D ---
                                # Tentukan titik referensi sepeda koordinat lokal (X=Kiri/Kanan, Y=Depan/Belakang, Z=Tinggi)
                                # Roda Belakang, Roda Depan, Kedudukan Stang
                                rb_x, rb_y, rb_z = rotate_points(0, -0.6, -0.3, roll, pitch)
                                rd_x, rd_y, rd_z = rotate_points(0, 0.6, -0.3, roll, pitch)
                                st_x, st_y, st_z = rotate_points(0, 0.4, 0.3, roll, pitch)
                                
                                # Sisi Kiri dan Kanan Stang Kemudi
                                h_l_x, h_l_y, h_l_z = rotate_points(-0.25, 0.4, 0.3, roll, pitch)
                                h_r_x, h_r_y, h_r_z = rotate_points(0.25, 0.4, 0.3, roll, pitch)

                                # Gambar Rangka Utama (Segitiga: Roda blg -> Roda dpn -> Stang -> Roda blg)
                                line_3d_frame.set_data([rb_x, rd_x, st_x, rb_x], [rb_y, rd_y, st_y, rb_y])
                                line_3d_frame.set_3d_properties([rb_z, rd_z, st_z, rb_z])
                                
                                # Gambar Stang (Garis Melintang kiri ke kanan)
                                line_3d_handle.set_data([h_l_x, h_r_x], [h_l_y, h_r_y])
                                line_3d_handle.set_3d_properties([h_l_z, h_r_z])

                                plt.pause(0.001)

                    except ValueError:
                        pass
                else:
                    plt.pause(0.001)

    except KeyboardInterrupt:
        print("\n\n[+] Pengambilan data dihentikan oleh pengguna.")
    
    finally:
        ser.close()
        print("[*] Port Serial Ditutup.")
        plt.ioff()
        plt.close(fig) 
        simpan_grafik_final()

def simpan_grafik_final():
    if not os.path.exists(CSV_FILENAME):
        print("[X] File CSV tidak ditemukan. Gagal mengekspor grafik.")
        return

    print("[*] Membaca database untuk membuat grafik ringkasan akhir...")
    df = pd.read_csv(CSV_FILENAME)
    if df.empty or len(df) < 2:
        return

    df['Detik'] = df['Timestamp'] - df['Timestamp'].iloc[0]
    fig, (ax1, ax2) = plt.subplots(2, 1, figsize=(12, 10), sharex=True)

    ax1.plot(df['Detik'], df['Accel_X'], label='Accel X', color='red', linewidth=1.2)
    ax1.plot(df['Detik'], df['Accel_Y'], label='Accel Y', color='green', linewidth=1.2)
    ax1.plot(df['Detik'], df['Accel_Z'], label='Accel Z', color='blue', linewidth=1.2)
    ax1.set_title('Grafik Pergerakan Akselerometer (Keseluruhan Data)', fontsize=14, fontweight='bold')
    ax1.set_ylabel('Nilai Akselerasi (LSB)')
    ax1.grid(True, linestyle='--')
    ax1.legend(loc='upper right')

    ax2.plot(df['Detik'], df['Gyro_X'], label='Gyro X', color='orange', linewidth=1.2)
    ax2.plot(df['Detik'], df['Gyro_Y'], label='Gyro Y', color='purple', linewidth=1.2)
    ax2.plot(df['Detik'], df['Gyro_Z'], label='Gyro Z', color='cyan', linewidth=1.2)
    ax2.set_title('Grafik Pergerakan Giroskop (Keseluruhan Data)', fontsize=14, fontweight='bold')
    ax2.set_xlabel('Waktu (Detik)')
    ax2.set_ylabel('Kecepatan Sudut (LSB)')
    ax2.grid(True, linestyle='--')
    ax2.legend(loc='upper right')

    plt.tight_layout()
    plt.savefig(GRAPH_FILENAME, dpi=300, bbox_inches='tight')
    print(f"[+] Grafik ringkasan berhasil disimpan di: {GRAPH_FILENAME}")
    plt.show()

if __name__ == '__main__':
    main()