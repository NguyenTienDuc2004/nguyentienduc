document.addEventListener('DOMContentLoaded', () => {
    // ==========================================
    // 1. CHUYỂN TRANG MƯỢT MÀ (NAVIGATION)
    // ==========================================
    const menuLinks = document.querySelectorAll('.menu li a');
    const contentSections = document.querySelectorAll('.content');

    menuLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            const href = link.getAttribute('href');
            if (!href || !href.startsWith('#')) return;

            e.preventDefault();
            document.querySelectorAll('.menu li').forEach(li => li.classList.remove('active'));
            link.parentElement.classList.add('active');

            const targetId = href.substring(1);
            contentSections.forEach(section => section.classList.remove('active'));

            const targetSection = document.getElementById(targetId);
            if (targetSection) targetSection.classList.add('active');
        });
    });

    // ==========================================
    // 2. BIẾN TOÀN CỤC & CÔNG CỤ
    // ==========================================
    let products = [];
    let categories = [];
    let suppliersData = [];
    let importCart = [];
    let exportCart = [];

    let editingProductId = null;
    let editingCategoryId = null;
    let editingSupplierId = null;

    let barChartInstance = null;
    let pieChartInstance = null;

    function formatCurrency(amount) {
        if (amount == null) return "0 ₫";
        return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount);
    }

    // ==========================================
    // 3. API & RENDER SẢN PHẨM / TỔNG QUAN
    // ==========================================
    window.fetchProducts = async function() {
        try {
            const response = await fetch('/api/products');
            const data = await response.json();
            products = data.map(p => ({
                id: p.MaHang, barcode: p.MaVach || 'Chưa có', name: p.TenHang,
                categoryName: p.PhanLoai || 'Chưa phân loại', categoryId: p.MaLoai || 'TP',
                quantity: p.SoLuongTon, importPrice: Number(p.GiaNhap), exportPrice: Number(p.GiaBan)
            }));

            renderDashboard();
            renderProducts();
            renderCharts();
            populateImportSelect();
            populateExportSelect();
        } catch (error) { console.error("Lỗi lấy sản phẩm:", error); }
    };

    function renderDashboard() {
        if(document.getElementById('total-products')) document.getElementById('total-products').textContent = products.length;
        let totalCost = 0; let expectedRevenue = 0;
        products.forEach(p => { totalCost += (p.quantity * p.importPrice); expectedRevenue += (p.quantity * p.exportPrice); });

        if(document.getElementById('total-cost')) document.getElementById('total-cost').textContent = formatCurrency(totalCost);
        if(document.getElementById('expected-revenue')) document.getElementById('expected-revenue').textContent = formatCurrency(expectedRevenue);
        if(document.getElementById('low-stock')) document.getElementById('low-stock').textContent = products.filter(p => p.quantity < 10).length;
    }

    function renderCharts() {
        const categoryCount = {};
        products.forEach(p => { categoryCount[p.categoryName] = (categoryCount[p.categoryName] || 0) + p.quantity; });
        const pieLabels = Object.keys(categoryCount);
        const pieData = Object.values(categoryCount);

        const pieCtx = document.getElementById('pieChart');
        if (pieCtx) {
            if (pieChartInstance) pieChartInstance.destroy();
            pieChartInstance = new Chart(pieCtx, {
                type: 'doughnut',
                data: { labels: pieLabels.length ? pieLabels : ['Trống'], datasets: [{ data: pieData.length ? pieData : [1], backgroundColor: ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'], borderWidth: 0 }] },
                options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom' } } }
            });
        }

        const barCtx = document.getElementById('barChart');
        if (barCtx) {
            if (barChartInstance) barChartInstance.destroy();
            barChartInstance = new Chart(barCtx, {
                type: 'bar',
                data: { labels: ['28/02', '01/03', '02/03', '03/03', '04/03', 'Hôm qua', 'Hôm nay'], datasets: [
                        { label: 'Chi Phí (VNĐ)', data: [15000000, 22000000, 8000000, 12000000, 5000000, 18000000, 25000000], backgroundColor: '#ef4444', borderRadius: 4 },
                        { label: 'Doanh Thu (VNĐ)', data: [20000000, 28000000, 15000000, 19000000, 11000000, 25000000, 32000000], backgroundColor: '#10b981', borderRadius: 4 }
                    ] },
                options: { responsive: true, maintainAspectRatio: false, scales: { y: { beginAtZero: true, ticks: { callback: function(value) { return (value / 1000000) + ' Tr'; } } } } }
            });
        }
    }

    function renderProducts() {
        const tbody = document.getElementById('products-list');
        if(!tbody) return;
        tbody.innerHTML = '';
        products.forEach(product => {
            const qtyStyle = product.quantity < 10 ? 'color: var(--danger); font-weight: bold;' : '';
            tbody.innerHTML += `
                <tr>
                    <td style="color: var(--text-muted); font-family: monospace;">${product.barcode}</td>
                    <td><strong>${product.id}</strong></td>
                    <td style="font-weight: 500;">${product.name}</td>
                    <td><span class="badge badge-info" style="background: #e0f2fe; color: #0284c7; padding: 4px 10px; border-radius: 20px; font-size: 0.8rem;">${product.categoryName}</span></td>
                    <td style="${qtyStyle}">${product.quantity}</td>
                    <td>${formatCurrency(product.importPrice)}</td>
                    <td>${formatCurrency(product.exportPrice)}</td>
                    <td>
                        <button onclick="editProduct('${product.id}')" class="btn-primary" style="padding: 6px 10px; font-size: 0.8rem; border-radius: 6px;"><i class="fa-solid fa-pen"></i></button>
                        <button onclick="deleteProduct('${product.id}')" class="btn-danger" style="padding: 6px 10px; font-size: 0.8rem; border-radius: 6px; margin-left: 5px;"><i class="fa-solid fa-trash"></i></button>
                    </td>
                </tr>
            `;
        });
    }

    const productModal = document.getElementById('product-modal');
    const btnAddProduct = document.getElementById('add-product');
    const formProduct = document.getElementById('add-product-form');

    if (btnAddProduct) {
        btnAddProduct.addEventListener('click', () => {
            editingProductId = null; formProduct.reset();
            document.getElementById('product-id').readOnly = false;
            document.getElementById('product-id').style.backgroundColor = 'white';
            productModal.style.display = 'flex';
        });
    }

    window.editProduct = function(id) {
        const p = products.find(x => x.id === id);
        if(p) {
            editingProductId = id;
            document.getElementById('product-id').value = p.id;
            document.getElementById('product-id').readOnly = true;
            document.getElementById('product-id').style.backgroundColor = '#f1f5f9';
            document.getElementById('product-barcode').value = p.barcode !== 'Chưa có' ? p.barcode : '';
            document.getElementById('product-category').value = p.categoryId;
            document.getElementById('product-name').value = p.name;
            document.getElementById('product-quantity').value = p.quantity;
            document.getElementById('product-import-price').value = p.importPrice;
            document.getElementById('product-export-price').value = p.exportPrice;
            productModal.style.display = 'flex';
        }
    }

    window.deleteProduct = async function(id) {
        if(confirm(`Xóa sản phẩm mã [${id}]?`)) {
            try {
                const res = await fetch(`/api/products/${id}`, { method: 'DELETE' });
                if(res.ok) fetchProducts();
                else { const r = await res.json(); alert(r.error); }
            } catch (err) { console.error(err); }
        }
    };

    if (formProduct) {
        formProduct.addEventListener('submit', async (e) => {
            e.preventDefault();
            const payload = {
                id: document.getElementById('product-id').value, barcode: document.getElementById('product-barcode').value,
                name: document.getElementById('product-name').value, category: document.getElementById('product-category').value,
                quantity: document.getElementById('product-quantity').value, importPrice: document.getElementById('product-import-price').value,
                exportPrice: document.getElementById('product-export-price').value
            };
            const method = editingProductId ? 'PUT' : 'POST';
            const url = editingProductId ? `/api/products/${editingProductId}` : '/api/products';
            try {
                const res = await fetch(url, { method: method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
                if(res.ok) { productModal.style.display = 'none'; fetchProducts(); }
                else { const err = await res.json(); alert("Lỗi: " + err.error); }
            } catch(err) { console.error(err); }
        });
    }

    // ==========================================
    // 4. API & RENDER NHÓM HÀNG
    // ==========================================
    window.fetchCategories = async function() {
        try {
            const res = await fetch('/api/categories');
            categories = await res.json();
            renderCategories();
            populateProductCategorySelect();
        } catch (error) { console.error(error); }
    };

    function renderCategories() {
        const tbody = document.getElementById('categories-list');
        if(!tbody) return;
        tbody.innerHTML = '';
        categories.forEach(cat => {
            tbody.innerHTML += `
                <tr>
                    <td><strong>${cat.MaLoai}</strong></td>
                    <td><span class="badge badge-info" style="background: #e0f2fe; color: #0284c7; padding: 4px 10px; border-radius: 20px; font-size: 0.8rem;">${cat.TenLoai}</span></td>
                    <td>${cat.MoTa || ''}</td>
                    <td>
                        <button onclick="editCategory('${cat.MaLoai}')" class="btn-primary" style="padding: 6px 10px; font-size: 0.8rem; border-radius: 6px;"><i class="fa-solid fa-pen"></i></button>
                        <button onclick="deleteCategory('${cat.MaLoai}')" class="btn-danger" style="padding: 6px 10px; font-size: 0.8rem; border-radius: 6px; margin-left: 5px;"><i class="fa-solid fa-trash"></i></button>
                    </td>
                </tr>
            `;
        });
    }

    function populateProductCategorySelect() {
        const selectCat = document.getElementById('product-category');
        if(selectCat) {
            selectCat.innerHTML = '';
            categories.forEach(cat => selectCat.innerHTML += `<option value="${cat.MaLoai}">${cat.TenLoai}</option>`);
        }
    }

    const catModal = document.getElementById('category-modal');
    const catForm = document.getElementById('add-category-form');
    const btnAddCat = document.getElementById('add-category');

    if (btnAddCat) {
        btnAddCat.addEventListener('click', () => {
            editingCategoryId = null; catForm.reset();
            document.getElementById('category-id').readOnly = false;
            document.getElementById('category-id').style.backgroundColor = 'white';
            catModal.style.display = 'flex';
        });
    }

    window.editCategory = function(id) {
        const cat = categories.find(c => c.MaLoai === id);
        if(cat) {
            editingCategoryId = id;
            document.getElementById('category-id').value = cat.MaLoai;
            document.getElementById('category-id').readOnly = true;
            document.getElementById('category-id').style.backgroundColor = '#f1f5f9';
            document.getElementById('category-name').value = cat.TenLoai;
            document.getElementById('category-desc').value = cat.MoTa || '';
            catModal.style.display = 'flex';
        }
    };

    window.deleteCategory = async function(id) {
        if(confirm(`Xóa nhóm hàng [${id}]?`)) {
            try {
                const res = await fetch(`/api/categories/${id}`, { method: 'DELETE' });
                if(res.ok) fetchCategories(); else { const r = await res.json(); alert(r.error); }
            } catch(e) { console.error(e); }
        }
    };

    if(catForm) {
        catForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const payload = { id: document.getElementById('category-id').value, name: document.getElementById('category-name').value, description: document.getElementById('category-desc').value };
            const method = editingCategoryId ? 'PUT' : 'POST';
            const url = editingCategoryId ? `/api/categories/${editingCategoryId}` : '/api/categories';
            try {
                const res = await fetch(url, { method: method, headers:{'Content-Type':'application/json'}, body: JSON.stringify(payload) });
                if(res.ok) { catModal.style.display = 'none'; fetchCategories(); fetchProducts(); }
                else { const err = await res.json(); alert("Lỗi: " + err.error); }
            } catch(err) { console.error(err); }
        });
    }

    // ==========================================
    // 5. API & RENDER NHÀ CUNG CẤP
    // ==========================================
    window.fetchSuppliers = async function() {
        try {
            const res = await fetch('/api/suppliers');
            suppliersData = await res.json();
            renderSuppliersList();
            populateImportSupplierSelect();
        } catch (error) { console.error(error); }
    };

    function renderSuppliersList() {
        const tbody = document.getElementById('suppliers-list');
        if(!tbody) return;
        tbody.innerHTML = '';
        suppliersData.forEach(sup => {
            tbody.innerHTML += `
                <tr>
                    <td><strong>${sup.MaNCC}</strong></td>
                    <td>${sup.TenNCC}</td>
                    <td>${sup.SoDienThoai || ''}</td>
                    <td>${sup.DiaChi || ''}</td>
                    <td>
                        <button onclick="editSupplier('${sup.MaNCC}')" class="btn-primary" style="padding: 6px 10px; font-size: 0.8rem; border-radius: 6px;"><i class="fa-solid fa-pen"></i></button>
                        <button onclick="deleteSupplier('${sup.MaNCC}')" class="btn-danger" style="padding: 6px 10px; font-size: 0.8rem; border-radius: 6px; margin-left: 5px;"><i class="fa-solid fa-trash"></i></button>
                    </td>
                </tr>
            `;
        });
    }

    function populateImportSupplierSelect() {
        const selectSup = document.getElementById('import-supplier');
        if(selectSup) {
            selectSup.innerHTML = '<option value="">-- Chọn Nhà Cung Cấp --</option>';
            suppliersData.forEach(sup => selectSup.innerHTML += `<option value="${sup.MaNCC}">[${sup.MaNCC}] - ${sup.TenNCC}</option>`);
        }
    }

    const supModal = document.getElementById('supplier-modal');
    const supForm = document.getElementById('add-supplier-form');
    const btnAddSup = document.getElementById('add-supplier');

    if (btnAddSup) {
        btnAddSup.addEventListener('click', () => {
            editingSupplierId = null; supForm.reset();
            document.getElementById('supplier-id').readOnly = false;
            document.getElementById('supplier-id').style.backgroundColor = 'white';
            supModal.style.display = 'flex';
        });
    }

    window.editSupplier = function(id) {
        const sup = suppliersData.find(s => s.MaNCC === id);
        if(sup) {
            editingSupplierId = id;
            document.getElementById('supplier-id').value = sup.MaNCC;
            document.getElementById('supplier-id').readOnly = true;
            document.getElementById('supplier-id').style.backgroundColor = '#f1f5f9';
            document.getElementById('supplier-name').value = sup.TenNCC;
            document.getElementById('supplier-phone').value = sup.SoDienThoai || '';
            document.getElementById('supplier-address').value = sup.DiaChi || '';
            supModal.style.display = 'flex';
        }
    };

    window.deleteSupplier = async function(id) {
        if(confirm(`Xóa nhà cung cấp [${id}]?`)) {
            try {
                const res = await fetch(`/api/suppliers/${id}`, { method: 'DELETE' });
                if(res.ok) fetchSuppliers(); else { const r = await res.json(); alert(r.error); }
            } catch(e) { console.error(e); }
        }
    };

    if(supForm) {
        supForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const payload = { id: document.getElementById('supplier-id').value, name: document.getElementById('supplier-name').value, phone: document.getElementById('supplier-phone').value, address: document.getElementById('supplier-address').value };
            const method = editingSupplierId ? 'PUT' : 'POST';
            const url = editingSupplierId ? `/api/suppliers/${editingSupplierId}` : '/api/suppliers';
            try {
                const res = await fetch(url, { method: method, headers:{'Content-Type':'application/json'}, body: JSON.stringify(payload) });
                if(res.ok) { supModal.style.display = 'none'; fetchSuppliers(); }
                else { const err = await res.json(); alert("Lỗi: " + err.error); }
            } catch(err) { console.error(err); }
        });
    }

    // ==========================================
    // 6. XỬ LÝ ĐÓNG MODAL CHUNG
    // ==========================================
    document.querySelectorAll('.close, .close-category, .close-supplier').forEach(btn => {
        btn.addEventListener('click', function() { this.closest('.modal').style.display = 'none'; });
    });
    window.addEventListener('click', (e) => {
        if (e.target.classList.contains('modal')) e.target.style.display = 'none';
    });

    // ==========================================
    // 7. XUẤT EXCEL
    // ==========================================
    const btnExportExcel = document.getElementById('export-all-products');
    if (btnExportExcel) {
        btnExportExcel.addEventListener('click', () => {
            if (products.length === 0) return alert("Không có dữ liệu!");
            const excelData = products.map((p, i) => ({ 'STT': i + 1, 'Mã Vạch': p.barcode !== 'Chưa có' ? p.barcode : '', 'Mã Sản Phẩm': p.id, 'Tên Sản Phẩm': p.name, 'Phân Loại': p.categoryName, 'Số Lượng Tồn': p.quantity, 'Giá Nhập (VNĐ)': p.importPrice, 'Giá Bán (VNĐ)': p.exportPrice }));
            const wb = XLSX.utils.book_new(); const ws = XLSX.utils.json_to_sheet(excelData);
            ws['!cols'] = [{wch: 5}, {wch: 15}, {wch: 12}, {wch: 40}, {wch: 15}, {wch: 12}, {wch: 15}, {wch: 15}];
            XLSX.utils.book_append_sheet(wb, ws, "Hang_Hoa");
            XLSX.writeFile(wb, `Kho_Sieu_Thi_${new Date().getTime()}.xlsx`);
        });
    }

    // ==========================================
    // 8. LẬP PHIẾU NHẬP KHO
    // ==========================================
    const importSelectSP = document.getElementById('import-sp-select');
    function populateImportSelect() {
        if(!importSelectSP) return;
        importSelectSP.innerHTML = '<option value="">-- Chọn Sản Phẩm --</option>';
        products.forEach(p => importSelectSP.innerHTML += `<option value="${p.id}">[${p.id}] - ${p.name}</option>`);
    }

    if (importSelectSP) {
        importSelectSP.addEventListener('change', (e) => {
            const p = products.find(x => x.id === e.target.value);
            document.getElementById('import-sp-price').value = p ? p.importPrice : '';
        });
    }

    function renderImportCart() {
        const tbody = document.querySelector('#import-cart-tbody');
        const totalUI = document.getElementById('import-total-ui');
        if (!tbody) return;
        tbody.innerHTML = ''; let total = 0;
        if (importCart.length === 0) { tbody.innerHTML = '<tr><td colspan="8" style="text-align:center;">Phiếu trống</td></tr>'; if(totalUI) totalUI.textContent = '0 VNĐ'; return; }

        importCart.forEach((item, index) => {
            const tt = item.soLuong * item.giaNhap; total += tt;
            const pInfo = products.find(p => p.id === item.maSP);
            tbody.innerHTML += `<tr><td>${index + 1}</td><td><strong>${item.maSP}</strong></td><td>${pInfo ? pInfo.name : ''}</td><td>${item.hsd ? new Date(item.hsd).toLocaleDateString('vi-VN') : 'Không có'}</td><td>${item.soLuong}</td><td>${formatCurrency(item.giaNhap)}</td><td><strong>${formatCurrency(tt)}</strong></td><td><button onclick="removeImportItem(${index})" class="btn-danger"><i class="fa-solid fa-xmark"></i></button></td></tr>`;
        });
        if(totalUI) totalUI.textContent = formatCurrency(total);
    }
    window.removeImportItem = function(i) { importCart.splice(i, 1); renderImportCart(); };

    const btnAddImport = document.getElementById('btn-add-import-item');
    if (btnAddImport) {
        btnAddImport.addEventListener('click', () => {
            const maSP = importSelectSP.value; const sl = parseInt(document.getElementById('import-sp-qty').value); const gn = parseFloat(document.getElementById('import-sp-price').value); const hsd = document.getElementById('import-sp-date').value;
            if (!maSP || isNaN(sl) || sl <= 0 || isNaN(gn) || gn < 0) return alert("Dữ liệu không hợp lệ!");
            const ex = importCart.find(i => i.maSP === maSP && i.hsd === hsd && i.giaNhap === gn);
            if(ex) ex.soLuong += sl; else importCart.push({ maSP, soLuong: sl, giaNhap: gn, hsd: hsd || null });
            importSelectSP.value = ''; document.getElementById('import-sp-qty').value = ''; document.getElementById('import-sp-price').value = ''; document.getElementById('import-sp-date').value = ''; renderImportCart();
        });
    }

    const btnSaveImport = document.querySelector('#import .content-header .btn-primary');
    if (btnSaveImport) {
        btnSaveImport.addEventListener('click', async () => {
            if (importCart.length === 0) return alert("Phiếu trống!");
            const payload = { nhaCungCap: document.getElementById('import-supplier').value, ngayNhap: document.getElementById('import-date').value || new Date().toISOString().split('T')[0], ghiChu: document.getElementById('import-note').value, chiTiet: importCart };
            try {
                const res = await fetch('/api/imports', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
                if (res.ok) { alert("Lưu Phiếu Nhập thành công!"); importCart = []; renderImportCart(); document.getElementById('import-note').value = ''; fetchProducts(); fetchHistory(); fetchExpiry(); } else { alert("Lỗi: " + (await res.json()).error); }
            } catch (err) { console.error(err); }
        });
    }

    // ==========================================
    // 9. LẬP PHIẾU XUẤT KHO
    // ==========================================
    const exportSelectSP = document.getElementById('export-sp-select');
    function populateExportSelect() {
        if(!exportSelectSP) return;
        exportSelectSP.innerHTML = '<option value="">-- Chọn Sản Phẩm --</option>';
        products.forEach(p => exportSelectSP.innerHTML += `<option value="${p.id}">[${p.id}] - ${p.name} (Tồn: ${p.quantity})</option>`);
    }

    if (exportSelectSP) {
        exportSelectSP.addEventListener('change', (e) => {
            const p = products.find(x => x.id === e.target.value);
            document.getElementById('export-sp-price').value = p ? p.exportPrice : '';
        });
    }

    function renderExportCart() {
        const tbody = document.getElementById('export-cart-tbody');
        const totalUI = document.getElementById('export-total-ui');
        if (!tbody) return;
        tbody.innerHTML = ''; let total = 0;
        if (exportCart.length === 0) { tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;">Phiếu trống</td></tr>'; if(totalUI) totalUI.textContent = '0 VNĐ'; return; }

        exportCart.forEach((item, index) => {
            const tt = item.soLuong * item.giaXuat; total += tt;
            const pInfo = products.find(p => p.id === item.maSP);
            tbody.innerHTML += `<tr><td>${index + 1}</td><td><strong>${item.maSP}</strong></td><td>${pInfo ? pInfo.name : ''}</td><td>${item.soLuong}</td><td>${formatCurrency(item.giaXuat)}</td><td><strong>${formatCurrency(tt)}</strong></td><td><button onclick="removeExportItem(${index})" class="btn-danger"><i class="fa-solid fa-xmark"></i></button></td></tr>`;
        });
        if(totalUI) totalUI.textContent = formatCurrency(total);
    }
    window.removeExportItem = function(i) { exportCart.splice(i, 1); renderExportCart(); };

    const btnAddExport = document.getElementById('btn-add-export-item');
    if (btnAddExport) {
        btnAddExport.addEventListener('click', () => {
            const maSP = exportSelectSP.value; const sl = parseInt(document.getElementById('export-sp-qty').value); const gx = parseFloat(document.getElementById('export-sp-price').value);
            if (!maSP || isNaN(sl) || sl <= 0 || isNaN(gx) || gx < 0) return alert("Dữ liệu không hợp lệ!");

            const pInfo = products.find(p => p.id === maSP);
            if (pInfo && sl > pInfo.quantity) return alert(`Lỗi: Chỉ còn ${pInfo.quantity} sản phẩm!`);

            const ex = exportCart.find(i => i.maSP === maSP && i.giaXuat === gx);
            if(ex) { if (ex.soLuong + sl > pInfo.quantity) return alert("Vượt tồn kho!"); ex.soLuong += sl; }
            else exportCart.push({ maSP, soLuong: sl, giaXuat: gx });

            exportSelectSP.value = ''; document.getElementById('export-sp-qty').value = ''; document.getElementById('export-sp-price').value = ''; renderExportCart();
        });
    }

    const btnSaveExport = document.querySelector('#export .content-header .btn-danger');
    if (btnSaveExport) {
        btnSaveExport.addEventListener('click', async () => {
            if (exportCart.length === 0) return alert("Phiếu trống!");
            const payload = { ngayXuat: document.getElementById('export-date').value || new Date().toISOString().split('T')[0], ghiChu: document.getElementById('export-note').value, chiTiet: exportCart };
            try {
                const res = await fetch('/api/exports', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
                if (res.ok) { alert("Lưu Phiếu Xuất thành công!"); exportCart = []; renderExportCart(); document.getElementById('export-note').value = ''; fetchProducts(); fetchHistory(); } else { alert("Lỗi: " + (await res.json()).error); }
            } catch (err) { console.error(err); }
        });
    }

    // ==========================================
    // 10. XỬ LÝ CẢNH BÁO HÀNG CẬN DATE
    // ==========================================
    window.fetchExpiry = async function() {
        try {
            const res = await fetch('/api/expiry');
            const data = await res.json();
            renderExpiryList(data);
        } catch (error) { console.error("Lỗi lấy dữ liệu cận date:", error); }
    };

    function renderExpiryList(data) {
        const tbody = document.getElementById('expiry-list');
        if (!tbody) return;
        tbody.innerHTML = '';

        const today = new Date();
        let nearExpiryCount = 0;

        if (data.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; color: var(--text-muted);">Kho chưa có dữ liệu lô hàng nào có hạn sử dụng.</td></tr>';
            if (document.getElementById('near-expiry')) document.getElementById('near-expiry').textContent = '0';
            return;
        }

        data.forEach(item => {
            const expDate = new Date(item.HanSuDung);
            const diffDays = Math.ceil((expDate - today) / (1000 * 60 * 60 * 24));
            let statusHtml = '';

            if (diffDays < 0) {
                nearExpiryCount++;
                statusHtml = '<span class="badge badge-danger" style="background-color: #fee2e2; color: #dc2626; padding: 4px 10px; border-radius: 20px; font-size: 0.8rem; font-weight: 600;">Đã hết hạn (' + Math.abs(diffDays) + ' ngày)</span>';
            } else if (diffDays <= 30) {
                nearExpiryCount++;
                statusHtml = '<span class="badge badge-warning" style="background-color: #fef3c7; color: #d97706; padding: 4px 10px; border-radius: 20px; font-size: 0.8rem; font-weight: 600;">Sắp hết hạn (' + diffDays + ' ngày)</span>';
            } else {
                statusHtml = '<span class="badge badge-success" style="background-color: #dcfce7; color: #16a34a; padding: 4px 10px; border-radius: 20px; font-size: 0.8rem; font-weight: 600;">Còn hạn an toàn</span>';
            }

            tbody.innerHTML += `
                <tr>
                    <td>${item.MaVach || 'Chưa có'}</td>
                    <td>${item.TenHang} <strong>(${item.MaHang})</strong></td>
                    <td>Lô nhập: ${item.SoLuong}</td>
                    <td><strong>${expDate.toLocaleDateString('vi-VN')}</strong></td>
                    <td>${statusHtml}</td>
                </tr>
            `;
        });

        if (document.getElementById('near-expiry')) {
            document.getElementById('near-expiry').textContent = nearExpiryCount;
        }
    }

    // ==========================================
    // 11. LỊCH SỬ GIAO DỊCH NHẬP / XUẤT
    // ==========================================
    window.fetchHistory = async function() {
        try {
            // Lấy Lịch sử Nhập
            const resImport = await fetch('/api/history/imports');
            const dataImport = await resImport.json();
            const tbodyImport = document.getElementById('history-import-list');
            if (tbodyImport) {
                tbodyImport.innerHTML = '';
                if (dataImport.length === 0) tbodyImport.innerHTML = '<tr><td colspan="5" style="text-align:center;">Chưa có dữ liệu nhập kho.</td></tr>';
                dataImport.forEach(item => {
                    tbodyImport.innerHTML += `<tr><td><strong>${item.MaPN}</strong></td><td>${item.NgayNhap}</td><td>${item.TenNCC || 'Không có'}</td><td>${item.GhiChu || ''}</td><td><strong><span style="color: var(--primary);">${formatCurrency(item.TongTien)}</span></strong></td></tr>`;
                });
            }

            // Lấy Lịch sử Xuất
            const resExport = await fetch('/api/history/exports');
            const dataExport = await resExport.json();
            const tbodyExport = document.getElementById('history-export-list');
            if (tbodyExport) {
                tbodyExport.innerHTML = '';
                if (dataExport.length === 0) tbodyExport.innerHTML = '<tr><td colspan="4" style="text-align:center;">Chưa có dữ liệu xuất kho.</td></tr>';
                dataExport.forEach(item => {
                    tbodyExport.innerHTML += `<tr><td><strong>${item.MaPX}</strong></td><td>${item.NgayXuat}</td><td>${item.GhiChu || ''}</td><td><strong><span style="color: var(--danger);">${formatCurrency(item.TongTien)}</span></strong></td></tr>`;
                });
            }
        } catch (error) { console.error("Lỗi lấy lịch sử:", error); }
    };

    // ==========================================
    // 12. KHỞI ĐỘNG HỆ THỐNG
    // ==========================================
    fetchCategories(); // Gọi loại hàng trước
    fetchSuppliers();  // Gọi NCC
    fetchProducts();   // Gọi Sản phẩm
    fetchExpiry();     // Gọi kiểm tra Date
    fetchHistory();    // Gọi Lịch sử giao dịch
});