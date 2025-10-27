(function() {
  if (document.getElementById('customModalOverlay')) return;

  const overlay = document.createElement('div');
  overlay.id = 'customModalOverlay';
  overlay.style.position = 'fixed';
  overlay.style.top = '0';
  overlay.style.left = '0';
  overlay.style.width = '100vw';
  overlay.style.height = '100vh';
  overlay.style.background = 'rgba(0,0,0,0.6)';
  overlay.style.display = 'flex';
  overlay.style.alignItems = 'center';
  overlay.style.justifyContent = 'center';
  overlay.style.zIndex = '999999';

  const modal = document.createElement('div');
  modal.style.background = '#fff';
  modal.style.padding = '20px';
  modal.style.borderRadius = '10px';
  modal.style.boxShadow = '0 4px 20px rgba(0,0,0,0.3)';
  modal.style.minWidth = '300px';
  modal.style.textAlign = 'center';
  modal.innerHTML = `
    <h3 style="margin-bottom:10px;">ระบุข้อความ</h3>
    <textarea id="userInputText" rows="4" style="width:100%;padding:8px;border:1px solid #ccc;border-radius:6px;"></textarea>
    <div style="margin-top:15px;display:flex;justify-content:center;gap:10px;">
      <button id="submitBtn" style="padding:8px 16px;border:none;background:#2563eb;color:white;border-radius:6px;cursor:pointer;">ส่ง</button>
      <button id="cancelBtn" style="padding:8px 16px;border:none;background:#aaa;color:white;border-radius:6px;cursor:pointer;">ยกเลิก</button>
    </div>
  `;

  overlay.appendChild(modal);
  document.body.appendChild(overlay);

  document.getElementById('submitBtn').onclick = () => {
    const val = document.getElementById('userInputText').value.trim();
    if (val) alert('ข้อความที่กรอก: ' + val);
    overlay.remove();
  };

  document.getElementById('cancelBtn').onclick = () => overlay.remove();
})();
