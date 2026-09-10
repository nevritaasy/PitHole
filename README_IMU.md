# IMU Monitoring System — STM32F401 + MPU6050

Modul **IMU (Inertial Measurement Unit)** untuk membaca data accelerometer dan gyroscope dari **MPU6050** menggunakan **STM32F401CCU6**, kemudian mengirimkan data ke laptop melalui UART untuk logging dan visualisasi real-time.

Modul ini digunakan sebagai bagian dari project **PitHole / road condition monitoring**, sehingga data IMU dapat dimanfaatkan untuk menganalisis getaran dan gerakan kendaraan saat melewati permukaan jalan.

## Fitur

- Membaca MPU6050 melalui **I2C1**.
- Membaca accelerometer 3-axis: X, Y, Z.
- Membaca gyroscope 3-axis: X, Y, Z.
- Membaca raw temperature MPU6050.
- Mengirim data melalui **USART2, 115200 baud**.
- Logging data otomatis ke CSV.
- Grafik accelerometer dan gyroscope secara real-time.
- Visualisasi orientasi 3D sederhana dari estimasi roll dan pitch.
- Peringatan sederhana jika data sensor terdeteksi berulang/freeze.
- Ekspor grafik keseluruhan data ke PNG setelah program dihentikan.

## Struktur Project

```text
IMU/
├── imu_STM32/
│   ├── Core/
│   │   ├── Inc/
│   │   └── Src/
│   │       └── main.c
│   ├── Drivers/
│   ├── imu.ioc
│   ├── .project
│   ├── .cproject
│   └── STM32F401CCUX_FLASH.ld
│
└── imu_monitoring_laptop/
    └── IMU.py
```

> Folder `Debug/` merupakan hasil build STM32CubeIDE dan sebaiknya tidak dimasukkan ke repository.

## Hardware

| Komponen | Fungsi |
|---|---|
| STM32F401CCU6 | Microcontroller utama |
| MPU6050 | Accelerometer + gyroscope 6-axis |
| USB-to-Serial / UART | Mengirim data STM32 ke laptop |
| Laptop/PC | Logging dan visualisasi data |

## Wiring MPU6050

Project menggunakan **I2C1**.

| MPU6050 | STM32F401CCU6 | Fungsi |
|---|---|---|
| VCC | 3.3 V | Power |
| GND | GND | Ground |
| SCL | PB6 | I2C1 SCL |
| SDA | PB7 | I2C1 SDA |

Firmware menggunakan:

```c
#define MPU6050_ADDR 0xD0
```

`0xD0` merupakan alamat `0x68` MPU6050 yang digeser satu bit ke kiri sesuai format addressing STM32 HAL.

## Konfigurasi UART

| Parameter | Nilai |
|---|---|
| Peripheral | USART2 |
| Baud rate | 115200 |
| Data bits | 8 |
| Stop bits | 1 |
| Parity | None |
| Flow control | None |
| TX | PA2 |
| RX | PA3 |

Untuk komunikasi satu arah ke laptop:

```text
STM32 PA2 (TX)  --->  RX USB-to-TTL
STM32 GND       --->  GND USB-to-TTL
```

## Format Data Serial

STM32 membaca 14 byte MPU6050 mulai register `0x3B`, lalu mengirim tujuh nilai dalam format CSV:

```text
Accel_X,Accel_Y,Accel_Z,Raw_Temp,Gyro_X,Gyro_Y,Gyro_Z
```

Contoh:

```text
-124,352,16384,-521,12,-18,4
```

Urutan data:

```text
AX, AY, AZ, TEMP, GX, GY, GZ
```

Semua nilai saat ini masih berupa **raw sensor value / LSB**. Firmware menggunakan `HAL_Delay(50)`, sehingga laju pengiriman nominal berada di sekitar **20 sampel/detik**, belum termasuk overhead I2C dan UART.

## Menjalankan Firmware STM32

Firmware berada di:

```text
IMU/imu_STM32/
```

Gunakan **STM32CubeIDE**:

1. Buka STM32CubeIDE.
2. Pilih **File → Import → Existing Projects into Workspace**.
3. Pilih folder `IMU/imu_STM32`.
4. Build project.
5. Flash firmware ke STM32F401CCU6.

Konfigurasi peripheral dapat dilihat melalui file:

```text
imu.ioc
```

Alur firmware:

```text
Boot STM32
    ↓
Initialize GPIO, I2C1, USART2
    ↓
Check MPU6050
    ↓
Wake MPU6050 dari sleep mode
    ↓
Read 14-byte sensor data
    ↓
Parse accel + temperature + gyro
    ↓
Format CSV
    ↓
Transmit USART2
    ↓
Delay 50 ms
    ↓
Repeat
```

Jika MPU6050 terdeteksi saat startup, firmware mengirim:

```text
MPU6050 Siap!
```

## Monitoring di Laptop

Program monitoring:

```text
IMU/imu_monitoring_laptop/IMU.py
```

### Requirements

Gunakan Python 3 dan install dependency:

```bash
pip install pyserial pandas matplotlib PyQt5
```

### Atur COM Port

Buka `IMU.py` dan ubah:

```python
COM_PORT = 'COM4'
```

sesuai COM port STM32 atau USB-to-Serial pada komputer.

Baud rate harus sesuai dengan firmware:

```python
BAUD_RATE = 115200
```

### Jalankan

```bash
cd IMU/imu_monitoring_laptop
python IMU.py
```

Jika berhasil:

```text
[*] Mencoba membuka port COM4...
[+] Berhasil terhubung ke COM4!
[*] Mulai mengambil data...
```

Tekan `CTRL+C` untuk menghentikan pengambilan data.

## Output

Data akan disimpan otomatis sebagai:

```text
data_sensor_mpu6050_YYYY-MM-DD_HH-MM-SS.csv
```

Dengan kolom:

```text
Timestamp,Accel_X,Accel_Y,Accel_Z,Suhu,Gyro_X,Gyro_Y,Gyro_Z
```

Setelah program dihentikan, grafik ringkasan disimpan sebagai:

```text
grafik_mpu6050_YYYY-MM-DD_HH-MM-SS.png
```

## Visualisasi Orientasi

Program Python memperkirakan roll dan pitch dari accelerometer:

```python
roll = math.atan2(ay, az)
pitch = math.atan2(-ax, math.sqrt(ay**2 + az**2))
```

Nilai tersebut digunakan untuk memutar model kendaraan sederhana pada visualisasi 3D.

> Visualisasi ini belum merupakan attitude estimation penuh. Belum ada complementary filter, Kalman filter, atau sensor fusion accelerometer-gyroscope.

## Catatan Data Sensor

Data yang dikirim STM32 masih merupakan data mentah MPU6050. Firmware belum melakukan konversi menjadi:

- `g` atau `m/s²` untuk accelerometer,
- `deg/s` untuk gyroscope,
- `°C` untuk temperature.

Kolom `Suhu` pada CSV saat ini berisi **raw temperature value**, bukan suhu dalam derajat Celsius.

## Troubleshooting

**COM port gagal dibuka**  
Pastikan `COM_PORT` benar dan port tidak sedang digunakan oleh aplikasi lain.

**Tidak ada data MPU6050**  
Periksa VCC, GND, SDA `PB7`, SCL `PB6`, dan alamat I2C sensor.

**Muncul `Sensor MPU6050 freeze!`**  
Periksa kestabilan koneksi I2C dan power sensor. Warning muncul ketika baris data yang sama diterima berulang kali.

**Matplotlib/Qt error**  
Install ulang backend GUI:

```bash
pip install matplotlib PyQt5
```

Script saat ini menggunakan:

```python
matplotlib.use('Qt5Agg')
```

## Pengembangan Selanjutnya

- Kalibrasi bias accelerometer dan gyroscope.
- Konversi raw data ke satuan fisik.
- Low-pass filtering untuk mengurangi noise.
- Complementary/Kalman filter untuk estimasi orientasi.
- Sinkronisasi timestamp IMU dan kamera.
- Ekstraksi fitur getaran untuk deteksi jalan rusak/pothole.
- Integrasi hasil IMU dengan deteksi kamera.
- Pembuatan dataset terlabel untuk training dan evaluasi model.

## Git Ignore

File hasil build sebaiknya tidak di-commit:

```gitignore
Debug/
Release/
*.o
*.d
*.su
*.cyclo
*.elf
*.bin
*.hex
*.map
*.list
__pycache__/
*.pyc
```

File seperti `.project`, `.cproject`, `.ioc`, source code, dan linker script tetap disimpan agar project STM32CubeIDE dapat dibuka kembali setelah repository di-clone.
