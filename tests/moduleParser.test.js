import {describe, expect, test, vi} from 'vitest';

import {parsePs33Node} from '../src/moduleParser.js';
import {parseXml, td, tr, table, section} from './utils.js';

/**
 * Tests for the 'moduleParser.js' file.
 */
/** @module tests/moduleParser */

/**
 * Build a `<td>` cell whose content is a description paragraph followed
 * by a `<variablelist>` (used to test enum extraction).
 *
 * @param {string} text The description text.
 * @param {string[]} terms The enum term values.
 * @returns {string} The cell XML string.
 */
function tdWithEnum(text, terms) {
  const entries = terms.map(function (term) {
    return '<varlistentry><term>' + term + '</term></varlistentry>';
  }).join('');
  return '<td><para>' + text + '</para><variablelist>' + entries +
    '</variablelist></td>';
}

/**
 * Build a `<section>` element wrapping a single `<table>`.
 *
 * @param {string} sectionLabel The section label.
 * @param {string} tableLabel The nested table label.
 * @param {string} caption The nested table caption.
 * @param {string[]} rows The nested table row XML strings.
 * @returns {string} The section XML string.
 */
function sectionWithTable(sectionLabel, tableLabel, caption, rows) {
  return section(sectionLabel, table(tableLabel, caption, rows));
}

/**
 * Build the MR Image IOD fragment (module list table, referenced
 * section and its attributes table), including one attribute that
 * shares the 'table_10-18' macro with the CT Image fixture.
 *
 * @returns {string} The MR Image IOD XML fragment.
 */
function mrImageFragment() {
  return table('A.4-1', 'MR Image IOD Modules', [
    tr([td('MR Specific Module'),
      td('<xref linkend="sect_C.8.1.1"/>'),
      td('M')])
  ]) + sectionWithTable(
    'C.8.1.1', 'C.8-1', 'MR Specific Module Module Attributes', [
      tr([td('MR Attribute'),
        td('(0018,0020)'),
        td('1'),
        td('MR desc.')]),
      tr([td('Include <xref linkend="table_10-18"/>')])
    ]);
}

/**
 * Build the shared 'table_10-18' macro table (an Include target),
 * referenced by both the CT and MR fixtures.
 *
 * @returns {string} The macro table XML fragment.
 */
function macroTableFragment() {
  return table('10-18', undefined, [
    tr([td('Code Value'),
      td('(0008,0100)'),
      td('1'),
      td('Macro attr desc.')])
  ]);
}

describe('parsePs33Node', () => {

  test('throws when the CT Image IOD module table is missing', () => {
    const doc = parseXml('<root></root>');
    const call = function () {
      parsePs33Node(doc, 'CT Image');
    };
    expect(call).toThrow(/No table node./);
  });

  test('throws when the CT Image IOD module table caption does not match',
    () => {
      const doc = parseXml('<root>' +
        table('A.3-1', 'Wrong', [tr([])]) + '</root>');
      const call = function () {
        parsePs33Node(doc, 'CT Image');
      };
      expect(call).toThrow(/The node caption is not the expected one/);
    });

  test('throws when an IOD module row has the wrong number of columns',
    () => {
      const doc = parseXml('<root>' +
        table('A.3-1', 'CT Image IOD Modules', [
          tr([td('Patient'), td('<xref linkend="sect_C.7.1.1"/>')])
        ]) + '</root>');
      const call = function () {
        parsePs33Node(doc, 'CT Image');
      };
      expect(call).toThrow(/Not the expected IOD module values size: 2/);
    });

  test(
    'throws when a module attributes table caption does not match',
    () => {
      const doc = parseXml('<root>' +
        table('A.3-1', 'CT Image IOD Modules', [
          tr([td('Patient'),
            td('<xref linkend="sect_C.7.1.1"/>'),
            td('M')])
        ]) +
        sectionWithTable('C.7.1.1', 'C.7-1', 'Wrong', [
          tr([td('Some Attribute'),
            td('(0018,0010)'),
            td('1'),
            td('Desc.')])
        ]) +
        mrImageFragment() + macroTableFragment() +
        '</root>');
      const call = function () {
        parsePs33Node(doc, 'CT Image');
      };
      expect(call).toThrow(/The node caption is not the expected one/);
    });

  test(
    'drops and warns about a module whose referenced section has no ' +
    'table',
    () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const doc = parseXml('<root>' +
        table('A.3-1', 'CT Image IOD Modules', [
          tr([td('Patient'),
            td('<xref linkend="sect_C.7.1.1"/>'),
            td('M')])
        ]) +
        '<section label="C.7.1.1"><para>No table here.</para></section>' +
        mrImageFragment() + macroTableFragment() +
        '</root>');

      const result = parsePs33Node(doc, 'CT Image');

      expect(result[0].name).toEqual('CT Image IOD Modules');
      expect(result[0].raw).toEqual([]);
      expect(JSON.parse(result[0].data)).toEqual({});
      expect(warn).toHaveBeenCalledWith(
        'Cannot find table for module: Patient');

      warn.mockRestore();
    });

  test(
    'drops and warns about a module that references a non-existent ' +
    'section',
    () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const doc = parseXml('<root>' +
        table('A.3-1', 'CT Image IOD Modules', [
          tr([td('Patient'),
            td('<xref linkend="sect_missing"/>'),
            td('M')])
        ]) +
        mrImageFragment() + macroTableFragment() +
        '</root>');

      const result = parsePs33Node(doc, 'CT Image');

      expect(result[0].name).toEqual('CT Image IOD Modules');
      expect(result[0].raw).toEqual([]);
      expect(JSON.parse(result[0].data)).toEqual({});
      expect(warn).toHaveBeenCalledWith(
        'Cannot find section for module: Patient');

      warn.mockRestore();
    });

  test(
    'parses IOD modules: usage/type filtering, enum and condition ' +
    'extraction, nested sequence items and macro includes',
    () => {
      const doc = parseXml('<root>' +
        table('A.3-1', 'CT Image IOD Modules', [
          tr([td('Patient'),
            td('<xref linkend="sect_C.7.1.1"/>'),
            td('M')]),
          // 'U' usage: excluded from the result entirely
          tr([td('Optional Module'),
            td('<xref linkend="sect_C.9.9.9"/>'),
            td('U')]),
          // 'C - Required if ...' usage: rewritten to plain 'C'
          tr([td('Conditional Module'),
            td('<xref linkend="sect_C.7.1.2"/>'),
            td('C - Required if Something (0008,0010) is present.')])
        ]) +
        sectionWithTable('C.7.1.1', 'C.7-1', 'Patient Module Attributes', [
          // type '1': kept, description + enum
          tr([td('Patient\'s Sex'),
            td('(0010,0040)'),
            td('1'),
            tdWithEnum('Patient\'s sex.', ['M', 'F', 'O'])]),
          // type '1C': kept, condition extracted, no description left
          tr([td('Context Group Extension Flag'),
            td('(0008,010B)'),
            td('1C'),
            td('Required if Context Identifier (0008,010F) is present.')]),
          // type '2': kept by the '1|1C|2|2C' type regex
          tr([td('Patient Comments'),
            td('(0010,4000)'),
            td('2'),
            td('User-defined comments.')]),
          // type '2C': kept by the '1|1C|2|2C' type regex
          tr([td('Ethnic Group'),
            td('(0010,2160)'),
            td('2C'),
            td('Ethnic group of the patient.')]),
          // type '3': filtered out by the '1|1C|2|2C' type regex
          tr([td('Some Optional Attribute'),
            td('(0010,0050)'),
            td('3'),
            td('Just a description.')]),
          // sequence parent (type '1') with one nested item
          tr([td('Referenced Study Sequence'),
            td('(0008,1110)'),
            td('1'),
            td('Sequence description.')]),
          tr([td('>Referenced SOP Class UID'),
            td('(0008,1150)'),
            td('1'),
            td('Child desc.')]),
          // macro include, shared with the MR Image fixture
          tr([td('Include <xref linkend="table_10-18"/>')])
        ]) +
        sectionWithTable(
          'C.7.1.2', 'C.7-2', 'Conditional Module Module Attributes', [
            tr([td('Some Attribute'),
              td('(0018,0010)'),
              td('1'),
              td('Desc.')])
          ]) +
        mrImageFragment() + macroTableFragment() +
        '</root>');

      const result = parsePs33Node(doc, 'CT Image', 'part03.xml');

      expect(result).toHaveLength(1);
      const [ctResult] = result;

      expect(ctResult.name).toEqual('CT Image IOD Modules');
      expect(ctResult.origin).toEqual('part03.xml');

      const codeValueAttribute = {
        name: 'Code Value',
        tag: '(0008,0100)',
        type: '1',
        desc: 'Macro attr desc.'
      };

      const expectedCt = [
        {
          name: 'Patient',
          attributes: [
            {
              name: 'Patient\'s Sex',
              tag: '(0010,0040)',
              type: '1',
              enum: ['M', 'F', 'O'],
              desc: 'Patient\'s sex.'
            },
            {
              name: 'Context Group Extension Flag',
              tag: '(0008,010B)',
              type: '1C',
              condition: ['Context Identifier',
                '(0008,010F)',
                'is present'],
              desc: ''
            },
            {
              name: 'Patient Comments',
              tag: '(0010,4000)',
              type: '2',
              desc: 'User-defined comments.'
            },
            {
              name: 'Ethnic Group',
              tag: '(0010,2160)',
              type: '2C',
              desc: 'Ethnic group of the patient.'
            },
            {
              name: 'Referenced Study Sequence',
              tag: '(0008,1110)',
              type: '1',
              desc: 'Sequence description.',
              items: [
                {
                  name: 'Referenced SOP Class UID',
                  tag: '(0008,1150)',
                  type: '1',
                  desc: 'Child desc.'
                }
              ]
            },
            codeValueAttribute
          ]
        },
        {
          name: 'Conditional Module',
          attributes: [
            {name: 'Some Attribute',
              tag: '(0018,0010)',
              type: '1',
              desc: 'Desc.'}
          ]
        }
      ];
      expect(ctResult.raw).toEqual(expectedCt);
      expect(JSON.parse(ctResult.data)).toEqual({
        Patient: expectedCt[0],
        'Conditional Module': expectedCt[1]
      });
    });

});
