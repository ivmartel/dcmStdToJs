import {describe, expect, test, vi} from 'vitest';

import {
  parseTableNode,
  cleanString,
  getSelector,
  getLinkend,
  checkNodeCaption,
  getStdInfo,
  getStdVersion
} from '../src/genericParser.js';
import {parseXml} from './utils.js';

/**
 * Tests for the 'genericParser.js' file.
 */
/** @module tests/genericParser */

describe('cleanString', () => {

  test('trims whitespace', () => {
    expect(cleanString('  hello  ')).toEqual('hello');
  });

  test('removes new lines', () => {
    expect(cleanString('hel\nlo\nworld')).toEqual('helloworld');
  });

  test('removes zero-width spaces', () => {
    expect(cleanString('hel​lo')).toEqual('hello');
  });

});

describe('getSelector', () => {

  test('gives table selector for table_ prefix', () => {
    expect(getSelector('table_E.1-1')).toEqual('table[label=\'E.1-1\']');
  });

  test('gives section selector for sect_ prefix', () => {
    expect(getSelector('sect_C.1-7')).toEqual('section[label=\'C.1-7\']');
  });

  test('throws for an unknown xml:id prefix', () => {
    const call = function () {
      getSelector('foo_bar');
    };
    expect(call).toThrow(/Unknown xml:id format./);
  });

});

describe('getLinkend', () => {

  test('extracts the linkend value', () => {
    const str = 'See linkend="sect_C.1-7" for Defined Terms.';
    expect(getLinkend(str)).toEqual('sect_C.1-7');
  });

  test('throws when no linkend is present', () => {
    const call = function () {
      getLinkend('no linkend here');
    };
    expect(call).toThrow(/Cannot find linkend value in:/);
  });

});

describe('checkNodeCaption', () => {

  test('throws when there is no caption', () => {
    const doc = parseXml('<table label="E.1-1"></table>');
    const call = function () {
      checkNodeCaption(doc.documentElement, 'Command Fields');
    };
    expect(call).toThrow(/Empty node caption./);
  });

  test('passes when caption equals expected text', () => {
    const doc = parseXml(
      '<table label="E.1-1"><caption>Command Fields</caption></table>');
    expect(function () {
      checkNodeCaption(doc.documentElement, 'Command Fields');
    }).not.toThrow();
  });

  test('accepts a caption differing only by case', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const doc = parseXml(
      '<table label="E.1-1"><caption>command fields</caption></table>');
    expect(function () {
      checkNodeCaption(doc.documentElement, 'Command Fields');
    }).not.toThrow();
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });

  test('throws when caption does not equal expected text', () => {
    const doc = parseXml(
      '<table label="E.1-1"><caption>Other</caption></table>');
    const call = function () {
      checkNodeCaption(doc.documentElement, 'Command Fields');
    };
    expect(call).toThrow(/The node caption is not the expected one/);
  });

  test('passes an include check when caption contains expected text', () => {
    const doc = parseXml(
      '<table label="E.1-1"><caption>Command Fields (Part 1)</caption>' +
      '</table>');
    expect(function () {
      checkNodeCaption(doc.documentElement, 'Command Fields', false);
    }).not.toThrow();
  });

  test('throws an include check when caption does not contain expected text',
    () => {
      const doc = parseXml(
        '<table label="E.1-1"><caption>Other</caption></table>');
      const call = function () {
        checkNodeCaption(doc.documentElement, 'Command Fields', false);
      };
      expect(call).toThrow(
        /The node caption does not include the expected one/);
    });

});

describe('getStdInfo', () => {

  test('throws when there is no book node', () => {
    const doc = parseXml('<root></root>');
    const call = function () {
      getStdInfo(doc);
    };
    expect(call).toThrow(/No book node./);
  });

  test('throws when the book has no label', () => {
    const doc = parseXml('<root><book></book></root>');
    const call = function () {
      getStdInfo(doc);
    };
    expect(call).toThrow(/No book label./);
  });

  test('throws when the book has no subtitle', () => {
    const doc = parseXml('<root><book label="PS3.7"></book></root>');
    const call = function () {
      getStdInfo(doc);
    };
    expect(call).toThrow(/No book subtitle./);
  });

  test('throws when the book subtitle is empty', () => {
    const doc = parseXml(
      '<root><book label="PS3.7"><subtitle></subtitle></book></root>');
    const call = function () {
      getStdInfo(doc);
    };
    expect(call).toThrow(/Empty book subtitle/);
  });

  test('returns the label and subtitle', () => {
    const doc = parseXml(
      '<root><book label="PS3.7">' +
      '<subtitle>DICOM PS3.7 2020a - Part 7</subtitle>' +
      '</book></root>');
    expect(getStdInfo(doc)).toEqual({
      label: 'PS3.7',
      subtitle: 'DICOM PS3.7 2020a - Part 7'
    });
  });

});

describe('getStdVersion', () => {

  test('throws when the subtitle is missing the DICOM prefix', () => {
    const call = function () {
      getStdVersion('PS3.7', 'DICOMx PS3.7 2020a - Part 7');
    };
    expect(call).toThrow(/Missing DICOM standard version prefix./);
  });

  test('throws when there is no version separator', () => {
    const call = function () {
      getStdVersion('PS3.7', 'DICOM PS3.7 2020a Part 7');
    };
    expect(call).toThrow(/Missing DICOM standard version./);
  });

  test('throws when the version string is empty', () => {
    const call = function () {
      getStdVersion('PS3.7', 'DICOM PS3.7 - Part 7');
    };
    expect(call).toThrow(/Missing DICOM standard version./);
  });

  test('parses the year and letter', () => {
    expect(getStdVersion('PS3.7', 'DICOM PS3.7 2020a - Part 7')).toEqual({
      year: 2020,
      letter: 'a'
    });
  });

});

describe('parseTableNode', () => {

  test('throws when there is no table node', () => {
    const call = function () {
      parseTableNode(undefined, undefined);
    };
    expect(call).toThrow(/No table node./);
  });

  test('throws when the caption does not match', () => {
    const doc = parseXml(
      '<table label="E.1-1"><caption>Other</caption>' +
      '<tbody><tr></tr></tbody></table>');
    const call = function () {
      parseTableNode(doc.documentElement, doc, 'Command Fields');
    };
    expect(call).toThrow(/The node caption is not the expected one/);
  });

  test('returns an empty array when there are no rows', () => {
    const doc = parseXml(
      '<table label="E.1-1"><caption>Command Fields</caption>' +
      '<tbody></tbody></table>');
    const result = parseTableNode(
      doc.documentElement, doc, 'Command Fields');
    expect(result).toEqual([]);
  });

  test('parses simple text cells', () => {
    const doc = parseXml(
      '<table label="E.1-1"><caption>Command Fields</caption>' +
      '<tbody><tr>' +
      '<td><para>(0000,0002)</para></td>' +
      '<td><para>Affected SOP Class UID</para></td>' +
      '</tr></tbody></table>');
    const result = parseTableNode(
      doc.documentElement, doc, 'Command Fields');
    expect(result).toEqual([
      [['(0000,0002)'], ['Affected SOP Class UID']]
    ]);
  });

  test('cleans whitespace and zero-width spaces in cell text', () => {
    const doc = parseXml(
      '<table label="E.1-1"><caption>Command Fields</caption>' +
      '<tbody><tr>' +
      '<td><para>\n  Affected​SOPClassUID  \n</para></td>' +
      '</tr></tbody></table>');
    const result = parseTableNode(
      doc.documentElement, doc, 'Command Fields');
    expect(result).toEqual([[['AffectedSOPClassUID']]]);
  });

  test('parses nested content nodes (e.g. a note wrapping a para)', () => {
    const doc = parseXml(
      '<table label="E.1-1"><caption>Command Fields</caption>' +
      '<tbody><tr>' +
      '<td><note><para>Some note text</para></note></td>' +
      '</tr></tbody></table>');
    const result = parseTableNode(
      doc.documentElement, doc, 'Command Fields');
    expect(result).toEqual([[['Some note text']]]);
  });

  test('parses an xref into its linkend attribute', () => {
    const doc = parseXml(
      '<table label="E.1-1"><caption>Command Fields</caption>' +
      '<tbody><tr>' +
      '<td><para>See <xref linkend="sect_C.1-7"/> for details</para></td>' +
      '</tr></tbody></table>');
    const result = parseTableNode(
      doc.documentElement, doc, 'Command Fields');
    expect(result).toEqual([[['See linkend="sect_C.1-7" for details']]]);
  });

  test('parses a variablelist into an enum string', () => {
    const doc = parseXml(
      '<table label="E.1-1"><caption>Command Fields</caption>' +
      '<tbody><tr>' +
      '<td><variablelist>' +
      '<varlistentry><term>YES</term></varlistentry>' +
      '<varlistentry><term>NO</term></varlistentry>' +
      '</variablelist></td>' +
      '</tr></tbody></table>');
    const result = parseTableNode(
      doc.documentElement, doc, 'Command Fields');
    expect(result).toEqual([[['enum=YES,NO;']]]);
  });

  test('resolves a "Defined Terms" link into the referenced enum list',
    () => {
      const doc = parseXml(
        '<root>' +
        '<table label="E.1-1"><caption>Command Fields</caption>' +
        '<tbody><tr>' +
        '<td><para>See <xref linkend="sect_C.1-7"/>' +
        ' for Defined Terms.</para></td>' +
        '</tr></tbody></table>' +
        '<section label="C.1-7"><variablelist>' +
        '<varlistentry><term>ENABLED</term></varlistentry>' +
        '<varlistentry><term>DISABLED</term></varlistentry>' +
        '</variablelist></section>' +
        '</root>');
      const table = doc.querySelector('table');
      const result = parseTableNode(table, doc, 'Command Fields');
      expect(result).toEqual([[['enum=ENABLED,DISABLED;']]]);
    });

  test('warns and leaves the link unresolved when the section is missing',
    () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const doc = parseXml(
        '<table label="E.1-1"><caption>Command Fields</caption>' +
        '<tbody><tr>' +
        '<td><para>See <xref linkend="sect_C.1-7"/>' +
        ' for Defined Terms.</para></td>' +
        '</tr></tbody></table>');
      const result = parseTableNode(
        doc.documentElement, doc, 'Command Fields');
      expect(result).toEqual([[
        ['See linkend="sect_C.1-7" for Defined Terms.']
      ]]);
      expect(warn).toHaveBeenCalledWith(
        expect.stringContaining('Did not find terms list with:'));
      warn.mockRestore();
    });

  test('parses multiple rows and multiple cells per row', () => {
    const doc = parseXml(
      '<table label="E.1-1"><caption>Command Fields</caption>' +
      '<tbody>' +
      '<tr><td><para>a1</para></td><td><para>a2</para></td></tr>' +
      '<tr><td><para>b1</para></td><td><para>b2</para></td></tr>' +
      '</tbody></table>');
    const result = parseTableNode(
      doc.documentElement, doc, 'Command Fields');
    expect(result).toEqual([
      [['a1'], ['a2']],
      [['b1'], ['b2']]
    ]);
  });

  test('parses without checking the caption when none is provided', () => {
    const doc = parseXml(
      '<table label="E.1-1"><caption>Anything</caption>' +
      '<tbody><tr><td><para>value</para></td></tr></tbody></table>');
    const result = parseTableNode(doc.documentElement, doc);
    expect(result).toEqual([[['value']]]);
  });

});
