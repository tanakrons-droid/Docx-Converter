// src/utils/cleanGutenbergTables.js
export function cleanGutenbergTables(html) {
  if (!html || typeof html !== 'string') return html;

  // สร้าง DOM ชั่วคราว
  const wrapper = (typeof document !== 'undefined')
    ? document.createElement('div')
    : null;

  if (!wrapper) return html; // ถ้าไม่มี DOM (เช่น SSR) ให้คืนค่าดิบ

  wrapper.innerHTML = html;

  // ช่วยฟังก์ชันเล็ก ๆ
  const unwrapTagsInside = (root, selector) => {
    root.querySelectorAll(selector).forEach((el) => {
      // อนุรักษ์ลูกทั้งหมด แล้วย้ายออกมาแทนที่ตัวห่อ
      const parent = el.parentNode;
      while (el.firstChild) parent.insertBefore(el.firstChild, el);
      parent.removeChild(el);
    });
  };

  const toArray = (nodeList) => Array.prototype.slice.call(nodeList);

  // ทุกตารางใน figure.wp-block-table
  wrapper.querySelectorAll('figure.wp-block-table table').forEach((table) => {
    // ----- 1) ให้มี thead แค่ 1 แถว -----
    let thead = table.querySelector('thead');
    // eslint-disable-next-line no-unused-vars
    let allRows = toArray(table.querySelectorAll('tr'));

    // ถ้าไม่มี thead ให้สร้างจากแถวแรก
    if (!thead) {
      const firstRow = table.querySelector('tr');
      if (firstRow) {
        thead = document.createElement('thead');
        table.insertBefore(thead, table.firstChild);
        thead.appendChild(firstRow);
      }
    }

    // ถ้ามี thead แล้ว แต่มีหลายแถวใน thead → คงไว้แค่แถวแรก ที่เหลือย้ายลง tbody
    if (thead) {
      const thRows = toArray(thead.querySelectorAll('tr'));
      if (thRows.length > 1) {
        const keep = thRows[0];
        const move = thRows.slice(1);
        // สร้าง/หา tbody
        let tbody = table.querySelector('tbody');
        if (!tbody) {
          tbody = document.createElement('tbody');
          table.appendChild(tbody);
        }
        move.forEach((r) => tbody.appendChild(r));
        // ให้แน่ใจว่า keep อยู่ใน thead จริง
        thead.innerHTML = '';
        thead.appendChild(keep);
      }
    }

    // ถ้าไม่มี tbody แต่มีแถวอื่นนอกจาก thead → สร้างแล้วรวบรวมให้หมด
    let tbody = table.querySelector('tbody');
    if (!tbody) {
      const rowsNotInThead = toArray(table.children).filter(
        (n) => n.tagName && n.tagName.toLowerCase() === 'tr'
      );
      if (rowsNotInThead.length) {
        tbody = document.createElement('tbody');
        table.appendChild(tbody);
        rowsNotInThead.forEach((r) => tbody.appendChild(r));
      }
    } else {
      // ย้าย tr ที่หลงอยู่นอก thead/tbody ลง tbody
      toArray(table.children).forEach((n) => {
        if (n.tagName && n.tagName.toLowerCase() === 'tr') {
          tbody.appendChild(n);
        }
      });
    }

    // ----- 2) บังคับให้ header row ใช้ <th> -----
    if (thead) {
      const headerRow = thead.querySelector('tr');
      if (headerRow) {
        toArray(headerRow.children).forEach((cell) => {
          if (!cell || !cell.tagName) return;
          if (cell.tagName.toLowerCase() !== 'th') {
            const th = document.createElement('th');
            // คง attributes
            toArray(cell.attributes).forEach(attr => th.setAttribute(attr.name, attr.value));
            th.innerHTML = cell.innerHTML;
            headerRow.replaceChild(th, cell);
          }
        });
      }
    }

    // ----- 3) ใน tbody: แปลง <th> ทั้งหมดเป็น <td> -----
    if (tbody) {
      toArray(tbody.querySelectorAll('th')).forEach((cell) => {
        const td = document.createElement('td');
        toArray(cell.attributes).forEach(attr => td.setAttribute(attr.name, attr.value));
        td.innerHTML = cell.innerHTML;
        cell.parentNode.replaceChild(td, cell);
      });
    }

    // ----- 4) ล้าง <p>, <div>, <span>, <font> ในทุก cell แต่คง <strong>/<em>/<a> -----
    table.querySelectorAll('td, th').forEach((cell) => {
      unwrapTagsInside(cell, 'p, div, span, font');

      // แทน <br> ด้วยช่องว่างเดียว (กันข้อความติดกัน)
      toArray(cell.querySelectorAll('br')).forEach((br) => {
        const space = document.createTextNode(' ');
        br.parentNode.replaceChild(space, br);
      });

      // ตัดช่องว่างเกิน
      cell.innerHTML = cell.innerHTML.replace(/\s+/g, ' ').trim();
    });

    // ----- 5) ความสะอาดทั่วไป (idempotent) -----
    // ลบ tr ว่างจริง ๆ (ถ้าเกิดจากการย้าย)
    toArray(table.querySelectorAll('tr')).forEach((tr) => {
      const text = tr.textContent ? tr.textContent.replace(/\s+/g, '') : '';
      if (!text) tr.remove();
    });
  });

  console.log('[TableCleaner] applied');
  return wrapper.innerHTML;
}






