/**
 * Shared helpers for building and parsing DICOM standard XML fixtures
 * across the parser test files.
 */
/** @module tests/utils */

/**
 * Parse an XML string into a DOM document.
 * The DICOM standard files are XML (not HTML), so tag names keep their
 * original case (unlike an HTML document, where they get upper-cased),
 * which matters for the case-sensitive nodeName checks in genericParser
 * (ex 'xref', 'variablelist', 'table').
 *
 * @param {string} str The XML string.
 * @returns {Document} The parsed document.
 */
export function parseXml(str) {
  const doc = new DOMParser().parseFromString(str, 'application/xml');
  const error = doc.getElementsByTagName('parsererror')[0];
  if (error) {
    throw new Error('XML parse error: ' + error.textContent);
  }
  return doc;
}

/**
 * Build a `<book>` element.
 *
 * @param {string} label The book label, ex 'PS3.7'.
 * @param {string} subtitle The book subtitle, ex
 *   'DICOM PS3.7 2020a - Part 7'.
 * @returns {string} The book XML string.
 */
export function bookXml(label, subtitle) {
  return '<book label="' + label + '"><subtitle>' + subtitle +
    '</subtitle></book>';
}

/**
 * Build a `<td><para>...</para></td>` cell.
 *
 * @param {string} innerXml The cell inner content (text and/or elements,
 *   ex an `<xref .../>`).
 * @returns {string} The cell XML string.
 */
export function td(innerXml) {
  return '<td><para>' + innerXml + '</para></td>';
}

/**
 * Build a `<tr>` row from an array of cell XML strings.
 *
 * @param {string[]} cells The cell XML strings (ex from `td()`).
 * @returns {string} The row XML string.
 */
export function tr(cells) {
  return '<tr>' + cells.join('') + '</tr>';
}

/**
 * Build a `<table>` element.
 *
 * @param {string} label The table label.
 * @param {string} [caption] Optional table caption; omit for tables that
 *   are not caption-checked (ex macro tables).
 * @param {string[]} [rows] The row XML strings (ex from `tr()`).
 * @returns {string} The table XML string.
 */
export function table(label, caption, rows) {
  const captionXml = typeof caption !== 'undefined'
    ? '<caption>' + caption + '</caption>' : '';
  return '<table label="' + label + '">' + captionXml +
    '<tbody>' + (rows ?? []).join('') + '</tbody></table>';
}

/**
 * Build a `<section>` element.
 *
 * @param {string} label The section label.
 * @param {string} innerXml The section inner content.
 * @returns {string} The section XML string.
 */
export function section(label, innerXml) {
  return '<section label="' + label + '">' + innerXml + '</section>';
}

/**
 * Build a table whose rows are simple text cells: each row is an array
 * of plain-text cell values, wrapped as `<td><para>value</para></td>`.
 *
 * @param {string} label The table label.
 * @param {string} [caption] Optional table caption.
 * @param {string[][]} rows The table rows (as arrays of cell text
 *   values).
 * @returns {string} The table XML string.
 */
export function simpleTableXml(label, caption, rows) {
  return table(label, caption, rows.map(function (cells) {
    return tr(cells.map(td));
  }));
}
