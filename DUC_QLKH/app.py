from flask import Flask, render_template, jsonify, request
import pyodbc
import datetime

app = Flask(__name__)

# Cấu hình kết nối SQL Server
SERVER_NAME = r'DESKTOP-03HPPQ8\VITHANHVAN'
DATABASE_NAME = 'QLKho_MinhCau'
CONN_STR = (
    r'DRIVER={ODBC Driver 17 for SQL Server};'
    f'SERVER={SERVER_NAME};'
    f'DATABASE={DATABASE_NAME};'
    r'Trusted_Connection=yes;'
)


def get_db_connection():
    return pyodbc.connect(CONN_STR)


@app.route('/')
def index():
    return render_template('index.html')


# --- 1. QUẢN LÝ SẢN PHẨM ---
@app.route('/api/products', methods=['GET'])
def get_products():
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        query = """
            SELECT h.MaHang, h.MaVach, h.TenHang, l.TenLoai AS PhanLoai, h.MaLoai,
                   h.SoLuongTon, h.GiaNhap, h.GiaBan 
            FROM HangHoa h
            LEFT JOIN LoaiHang l ON h.MaLoai = l.MaLoai
        """
        cursor.execute(query)
        columns = [column[0] for column in cursor.description]
        products = [dict(zip(columns, row)) for row in cursor.fetchall()]
        conn.close()
        return jsonify(products)
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route('/api/products', methods=['POST'])
def add_product():
    try:
        data = request.json
        conn = get_db_connection()
        cursor = conn.cursor()
        quantity = int(data.get('quantity', 0))
        import_price = float(data.get('importPrice', 0))
        export_price = float(data.get('exportPrice', 0))
        barcode = data.get('barcode', '')
        category = data.get('category', 'TP')

        query = """
            INSERT INTO HangHoa (MaHang, MaVach, TenHang, MaLoai, SoLuongTon, GiaNhap, GiaBan, DonViTinh)
            VALUES (?, ?, ?, ?, ?, ?, ?, N'Cái') 
        """
        cursor.execute(query, (data['id'], barcode, data['name'], category, quantity, import_price, export_price))
        conn.commit()
        conn.close()
        return jsonify({"message": "Thêm sản phẩm thành công!"}), 201
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route('/api/products/<product_id>', methods=['PUT'])
def update_product(product_id):
    try:
        data = request.json
        conn = get_db_connection()
        cursor = conn.cursor()
        quantity = int(data.get('quantity', 0))
        import_price = float(data.get('importPrice', 0))
        export_price = float(data.get('exportPrice', 0))
        barcode = data.get('barcode', '')
        category = data.get('category', 'TP')

        query = """
            UPDATE HangHoa 
            SET MaVach = ?, TenHang = ?, MaLoai = ?, SoLuongTon = ?, GiaNhap = ?, GiaBan = ?
            WHERE MaHang = ?
        """
        cursor.execute(query, (barcode, data['name'], category, quantity, import_price, export_price, product_id))
        conn.commit()
        conn.close()
        return jsonify({"message": "Cập nhật thành công!"}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route('/api/products/<product_id>', methods=['DELETE'])
def delete_product(product_id):
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("DELETE FROM HangHoa WHERE MaHang = ?", (product_id,))
        conn.commit()
        conn.close()
        return jsonify({"message": "Xóa thành công!"}), 200
    except Exception as e:
        return jsonify({"error": "Sản phẩm này đã có giao dịch, không thể xóa!"}), 400


# --- 2. LẬP PHIẾU NHẬP KHO ---
@app.route('/api/imports', methods=['POST'])
def create_import():
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        data = request.json
        ma_pn = "PN" + datetime.datetime.now().strftime("%Y%m%d%H%M%S")
        ngay_nhap = data.get('ngayNhap')
        ghi_chu = data.get('ghiChu', '')
        nha_cung_cap = data.get('nhaCungCap', None)
        chi_tiet = data.get('chiTiet', [])

        query_pn = "INSERT INTO PhieuNhap (MaPN, NgayNhap, MaNCC, GhiChu) VALUES (?, ?, ?, ?)"
        cursor.execute(query_pn, (ma_pn, ngay_nhap, nha_cung_cap, ghi_chu))

        query_ct = "INSERT INTO ChiTietPhieuNhap (MaPN, MaHang, SoLuong, DonGiaNhap, HanSuDung) VALUES (?, ?, ?, ?, ?)"
        for item in chi_tiet:
            hsd = item.get('hsd')
            if hsd == '': hsd = None
            cursor.execute(query_ct, (ma_pn, item['maSP'], item['soLuong'], item['giaNhap'], hsd))

        conn.commit()
        return jsonify({"message": "Tạo phiếu nhập thành công!", "MaPN": ma_pn}), 201
    except Exception as e:
        conn.rollback()
        return jsonify({"error": str(e)}), 500
    finally:
        conn.close()


# --- 3. LẬP PHIẾU XUẤT KHO ---
@app.route('/api/exports', methods=['POST'])
def create_export():
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        data = request.json
        ma_px = "PX" + datetime.datetime.now().strftime("%Y%m%d%H%M%S")
        ngay_xuat = data.get('ngayXuat')
        ghi_chu = data.get('ghiChu', '')
        chi_tiet = data.get('chiTiet', [])

        query_px = "INSERT INTO PhieuXuat (MaPX, NgayXuat, GhiChu) VALUES (?, ?, ?)"
        cursor.execute(query_px, (ma_px, ngay_xuat, ghi_chu))

        query_ct = "INSERT INTO ChiTietPhieuXuat (MaPX, MaHang, SoLuong, DonGiaXuat) VALUES (?, ?, ?, ?)"
        for item in chi_tiet:
            cursor.execute(query_ct, (ma_px, item['maSP'], item['soLuong'], item['giaXuat']))

        conn.commit()
        return jsonify({"message": "Tạo phiếu xuất thành công!", "MaPX": ma_px}), 201
    except Exception as e:
        conn.rollback()
        return jsonify({"error": str(e)}), 500
    finally:
        conn.close()


# --- 4. QUẢN LÝ NHÓM HÀNG ---
@app.route('/api/categories', methods=['GET'])
def get_categories():
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("SELECT MaLoai, TenLoai, MoTa FROM LoaiHang")
        columns = [column[0] for column in cursor.description]
        categories = [dict(zip(columns, row)) for row in cursor.fetchall()]
        conn.close()
        return jsonify(categories)
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route('/api/categories', methods=['POST'])
def add_category():
    try:
        data = request.json
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("INSERT INTO LoaiHang (MaLoai, TenLoai, MoTa) VALUES (?, ?, ?)",
                       (data['id'], data['name'], data.get('description', '')))
        conn.commit()
        conn.close()
        return jsonify({"message": "Thêm nhóm hàng thành công!"}), 201
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route('/api/categories/<cat_id>', methods=['PUT'])
def update_category(cat_id):
    try:
        data = request.json
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("UPDATE LoaiHang SET TenLoai = ?, MoTa = ? WHERE MaLoai = ?",
                       (data['name'], data.get('description', ''), cat_id))
        conn.commit()
        conn.close()
        return jsonify({"message": "Sửa nhóm hàng thành công!"}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route('/api/categories/<cat_id>', methods=['DELETE'])
def delete_category(cat_id):
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("DELETE FROM LoaiHang WHERE MaLoai = ?", (cat_id,))
        conn.commit()
        conn.close()
        return jsonify({"message": "Xóa thành công!"}), 200
    except Exception as e:
        return jsonify({"error": "Không thể xóa! Đang có sản phẩm thuộc nhóm hàng này."}), 400


# --- 5. QUẢN LÝ NHÀ CUNG CẤP ---
@app.route('/api/suppliers', methods=['GET'])
def get_suppliers():
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("SELECT MaNCC, TenNCC, SoDienThoai, DiaChi FROM NhaCungCap")
        columns = [column[0] for column in cursor.description]
        suppliers = [dict(zip(columns, row)) for row in cursor.fetchall()]
        conn.close()
        return jsonify(suppliers)
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route('/api/suppliers', methods=['POST'])
def add_supplier():
    try:
        data = request.json
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("INSERT INTO NhaCungCap (MaNCC, TenNCC, SoDienThoai, DiaChi) VALUES (?, ?, ?, ?)",
                       (data['id'], data['name'], data.get('phone', ''), data.get('address', '')))
        conn.commit()
        conn.close()
        return jsonify({"message": "Thêm nhà cung cấp thành công!"}), 201
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route('/api/suppliers/<sup_id>', methods=['PUT'])
def update_supplier(sup_id):
    try:
        data = request.json
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("UPDATE NhaCungCap SET TenNCC = ?, SoDienThoai = ?, DiaChi = ? WHERE MaNCC = ?",
                       (data['name'], data.get('phone', ''), data.get('address', ''), sup_id))
        conn.commit()
        conn.close()
        return jsonify({"message": "Sửa thông tin thành công!"}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route('/api/suppliers/<sup_id>', methods=['DELETE'])
def delete_supplier(sup_id):
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("DELETE FROM NhaCungCap WHERE MaNCC = ?", (sup_id,))
        conn.commit()
        conn.close()
        return jsonify({"message": "Xóa thành công!"}), 200
    except Exception as e:
        return jsonify({"error": "Không thể xóa! Nhà cung cấp này đã có giao dịch nhập hàng."}), 400


# --- 6. CẢNH BÁO HÀNG CẬN DATE ---
@app.route('/api/expiry', methods=['GET'])
def get_expiry():
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        query = """
            SELECT h.MaVach, h.MaHang, h.TenHang, c.SoLuong, c.HanSuDung 
            FROM ChiTietPhieuNhap c
            JOIN HangHoa h ON c.MaHang = h.MaHang
            WHERE c.HanSuDung IS NOT NULL
            ORDER BY c.HanSuDung ASC
        """
        cursor.execute(query)
        columns = [column[0] for column in cursor.description]

        expiry_data = []
        for row in cursor.fetchall():
            row_dict = dict(zip(columns, row))
            if row_dict['HanSuDung']:
                row_dict['HanSuDung'] = row_dict['HanSuDung'].strftime('%Y-%m-%d')
            expiry_data.append(row_dict)

        conn.close()
        return jsonify(expiry_data)
    except Exception as e:
        return jsonify({"error": str(e)}), 500


# --- 7. LỊCH SỬ PHIẾU NHẬP / XUẤT ---
@app.route('/api/history/imports', methods=['GET'])
def get_import_history():
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        query = """
            SELECT p.MaPN, p.NgayNhap, n.TenNCC, p.GhiChu, SUM(c.SoLuong * c.DonGiaNhap) as TongTien
            FROM PhieuNhap p
            LEFT JOIN NhaCungCap n ON p.MaNCC = n.MaNCC
            LEFT JOIN ChiTietPhieuNhap c ON p.MaPN = c.MaPN
            GROUP BY p.MaPN, p.NgayNhap, n.TenNCC, p.GhiChu
            ORDER BY p.NgayNhap DESC, p.MaPN DESC
        """
        cursor.execute(query)
        columns = [column[0] for column in cursor.description]

        history = []
        for row in cursor.fetchall():
            row_dict = dict(zip(columns, row))
            if row_dict['NgayNhap']:
                row_dict['NgayNhap'] = row_dict['NgayNhap'].strftime('%d/%m/%Y')
            history.append(row_dict)

        conn.close()
        return jsonify(history)
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route('/api/history/exports', methods=['GET'])
def get_export_history():
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        query = """
            SELECT p.MaPX, p.NgayXuat, p.GhiChu, SUM(c.SoLuong * c.DonGiaXuat) as TongTien
            FROM PhieuXuat p
            LEFT JOIN ChiTietPhieuXuat c ON p.MaPX = c.MaPX
            GROUP BY p.MaPX, p.NgayXuat, p.GhiChu
            ORDER BY p.NgayXuat DESC, p.MaPX DESC
        """
        cursor.execute(query)
        columns = [column[0] for column in cursor.description]

        history = []
        for row in cursor.fetchall():
            row_dict = dict(zip(columns, row))
            if row_dict['NgayXuat']:
                row_dict['NgayXuat'] = row_dict['NgayXuat'].strftime('%d/%m/%Y')
            history.append(row_dict)

        conn.close()
        return jsonify(history)
    except Exception as e:
        return jsonify({"error": str(e)}), 500


if __name__ == '__main__':
    app.run(debug=True, port=5000)