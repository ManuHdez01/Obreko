// Permite añadir/quitar campos en los .form-grid marcados con data-editable-fields="true".
// Útil para secciones de "Datos de superficie" donde no todas las viviendas
// tienen los mismos espacios (terraza, jardín, etc.).

(function () {
  'use strict';

  const GRID_SEL = '[data-editable-fields]';

  function injectStyles() {
    if (document.getElementById('field-mgr-styles')) return;
    const s = document.createElement('style');
    s.id = 'field-mgr-styles';
    s.textContent = `
      [data-editable-fields] .form-field{position:relative;}
      .field-remove-btn{
        position:absolute;top:-6px;right:-6px;width:20px;height:20px;border-radius:50%;
        background:rgba(26,34,54,.82);color:#fff;border:none;font-size:13pt;line-height:1;
        cursor:pointer;padding:0;display:flex;align-items:center;justify-content:center;
        opacity:0;transition:opacity .15s,background .15s;
        font-family:'DM Sans',Arial,sans-serif;z-index:2;
      }
      [data-editable-fields] .form-field:hover .field-remove-btn{opacity:1;}
      .field-remove-btn:hover{background:#C62828;}
      .field-add-btn{
        display:inline-flex;align-items:center;gap:6px;margin-top:14px;
        padding:7px 14px;border:1.5px dashed var(--blue, #5C7CD9);
        background:rgba(92,124,217,.03);color:var(--blue, #5C7CD9);
        font-family:'DM Sans',Arial,sans-serif;font-size:8.5pt;text-transform:uppercase;
        letter-spacing:.14em;font-weight:700;cursor:pointer;transition:background .15s;
      }
      .field-add-btn::before{content:'+';font-size:14px;font-weight:400;letter-spacing:0;line-height:1;}
      .field-add-btn:hover{background:rgba(92,124,217,.08);}
      @media print{
        .field-remove-btn,.field-add-btn{display:none !important;}
      }
    `;
    document.head.appendChild(s);
  }

  function makeFieldRemovable(field) {
    if (field.querySelector('.field-remove-btn')) return;
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'field-remove-btn';
    btn.textContent = '×';
    btn.title = 'Eliminar campo';
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      field.remove();
    });
    field.appendChild(btn);
  }

  function addAddButton(grid) {
    // Evita duplicar si ya hay uno asociado
    if (grid.nextElementSibling && grid.nextElementSibling.classList.contains('field-add-btn')) return;
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'field-add-btn';
    btn.textContent = 'Añadir campo';
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      const field = document.createElement('div');
      field.className = 'form-field';
      field.innerHTML = '<label contenteditable="true">Nuevo campo</label>' +
                        '<input type="text" placeholder="…">';
      grid.appendChild(field);
      makeFieldRemovable(field);
      // Foco en el label y seleccionar texto para facilitar renombrar
      const label = field.querySelector('label');
      if (label) {
        label.focus();
        const range = document.createRange();
        range.selectNodeContents(label);
        const sel = window.getSelection();
        sel.removeAllRanges();
        sel.addRange(range);
      }
    });
    grid.parentNode.insertBefore(btn, grid.nextSibling);
  }

  function init() {
    injectStyles();
    document.querySelectorAll(GRID_SEL).forEach((grid) => {
      grid.querySelectorAll('.form-field').forEach(makeFieldRemovable);
      addAddButton(grid);
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
