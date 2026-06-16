# ⚙️ ExternaWear Backend

Backend RESTful API untuk aplikasi e-commerce **ExternaWear** yang dibangun menggunakan **Node.js**, **Express.js**, dan **PostgreSQL**. Sistem dirancang dengan arsitektur **Serverless-ready**, aman, scalable, dan mendukung integrasi pembayaran online melalui **Xendit Payment Gateway**.

---

## 🚀 Fitur Utama

### 🔐 Sistem Autentikasi & Keamanan

* Registrasi akun pengguna
* Login & Logout
* Password hashing menggunakan **bcrypt**
* Autentikasi berbasis **JSON Web Token (JWT)**
* Middleware proteksi endpoint

### 🍪 Cross-Domain Authentication

* Secure HTTP-only Cookies
* Konfigurasi `sameSite: 'none'`
* Mendukung komunikasi antara Frontend dan Backend pada domain berbeda (Vercel Deployment)

### 👥 Role-Based Access Control (RBAC)

* Role **Admin**
* Role **Customer**
* Middleware otorisasi berbasis role
* Proteksi endpoint administratif

### 🗄️ Manajemen Database

* PostgreSQL sebagai database utama
* Query langsung menggunakan **Node-Postgres (pg)**
* Manajemen data:

  * Users
  * Products
  * Orders
  * Payments

### 💳 Integrasi Payment Gateway

* Pembuatan invoice otomatis
* Integrasi dengan **Xendit API**
* Redirect pembayaran ke halaman Xendit
* Tracking status pembayaran

---

## 🛠 Tech Stack

| Teknologi          | Versi | Keterangan                            |
| ------------------ | ----- | ------------------------------------- |
| Node.js            | 20.x  | JavaScript Runtime Environment        |
| Express.js         | 4.x   | Backend Web Framework                 |
| PostgreSQL         | 15.x  | Relational Database Management System |
| pg (Node-Postgres) | 8.x   | PostgreSQL Client                     |
| jsonwebtoken       | 9.x   | JWT Authentication                    |
| bcrypt             | 5.x   | Password Hashing                      |
| Xendit Node SDK    | 3.x   | Payment Gateway Integration           |
| pnpm               | 9.x   | Package Manager                       |

---

## 📂 Struktur Proyek

```bash
externawear-backend/
├── controllers/
├── middleware/
├── routes/
├── services/
├── utils/
├── database/
├── config/
├── app.js
├── server.js
├── package.json
└── .env.example
```

---

## 🚀 Instalasi dan Menjalankan Proyek

### 1️⃣ Clone Repository

```bash
git clone https://github.com/USERNAME_GITHUB/externawear-backend.git
cd externawear-backend
```

### 2️⃣ Install Dependencies

Menggunakan **pnpm**:

```bash
pnpm install
```

### 3️⃣ Konfigurasi Environment

Salin file `.env.example` menjadi `.env`

```bash
cp .env.example .env
```

Isi konfigurasi sesuai kebutuhan:

```env
# Database
DATABASE_URL=postgresql://username:password@localhost:5432/externawear

# JWT
JWT_SECRET=your_super_secret_key

# Frontend URL
CLIENT_ORIGIN=http://localhost:5173

# Xendit
XENDIT_SECRET_KEY=xnd_development_xxxxxxxxx
```

---

### 4️⃣ Jalankan Development Server

```bash
pnpm run dev
```

Server akan berjalan pada:

```bash
http://localhost:5000
```

---

## 📡 API Endpoint Overview

### Authentication

| Method | Endpoint             | Deskripsi              |
| ------ | -------------------- | ---------------------- |
| POST   | `/api/auth/register` | Registrasi pengguna    |
| POST   | `/api/auth/login`    | Login pengguna         |
| POST   | `/api/auth/logout`   | Logout pengguna        |
| GET    | `/api/auth/me`       | Data pengguna saat ini |

### Products

| Method | Endpoint            | Deskripsi             |
| ------ | ------------------- | --------------------- |
| GET    | `/api/products`     | Ambil semua produk    |
| GET    | `/api/products/:id` | Detail produk         |
| POST   | `/api/products`     | Tambah produk (Admin) |
| PUT    | `/api/products/:id` | Update produk (Admin) |
| DELETE | `/api/products/:id` | Hapus produk (Admin)  |

### Orders

| Method | Endpoint          | Deskripsi       |
| ------ | ----------------- | --------------- |
| POST   | `/api/orders`     | Buat pesanan    |
| GET    | `/api/orders`     | Riwayat pesanan |
| GET    | `/api/orders/:id` | Detail pesanan  |

### Payments

| Method | Endpoint                       | Deskripsi           |
| ------ | ------------------------------ | ------------------- |
| POST   | `/api/payments/create-invoice` | Buat invoice Xendit |
| POST   | `/api/payments/webhook`        | Webhook pembayaran  |

---

## 🔒 Keamanan

* Password Hashing dengan bcrypt
* JWT Authentication
* HTTP-only Cookies
* Secure Cookies
* CORS Protection
* Role-Based Authorization
* Environment Variables Protection

---

## 🗄️ Database

Database menggunakan PostgreSQL dengan tabel utama:

```sql
Users
Products
Orders
Order_Items
Payments
```

Relasi data dirancang untuk mendukung proses transaksi e-commerce secara lengkap.

---

## 🌐 Deployment

Backend dapat di-deploy pada platform berikut:

* Vercel (Serverless Functions)
* Railway
* Render
* VPS Linux
* Docker Environment

---

## 🤝 Kontribusi

Kontribusi sangat terbuka.

1. Fork repository
2. Buat branch baru

```bash
git checkout -b feature/nama-fitur
```

3. Commit perubahan

```bash
git commit -m "Menambahkan fitur baru"
```

4. Push ke repository

```bash
git push origin feature/nama-fitur
```

5. Buat Pull Request

---

## 📄 License

Project ini dibuat untuk kebutuhan pembelajaran dan pengembangan aplikasi e-commerce modern.

---

<div align="center">

### 👨‍💻 Author

**Ahmad Zaki Hossam Mido**

Backend Developer • Full Stack Developer

© 2026 ExternaWear. All Rights Reserved.

</div>
