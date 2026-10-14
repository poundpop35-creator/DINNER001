try { await import('./app.js?v=20261014c'); }
catch {
 const main=document.querySelector('#main');
 main.replaceChildren();
 const title=document.createElement('h1');title.textContent='เปิดห้องเรียนไม่สำเร็จ';
 const message=document.createElement('p');message.textContent='ลองตรวจการเชื่อมต่อแล้วโหลดใหม่ ความคืบหน้าที่บันทึกไว้ยังไม่ถูกลบ';
 const button=document.createElement('button');button.className='button primary';button.textContent='ลองอีกครั้ง';button.addEventListener('click',()=>location.reload());
 main.append(title,message,button);
}
