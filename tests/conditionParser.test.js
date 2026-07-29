import {describe, expect, test} from 'vitest';

import {extractCondition} from '../src/conditionParser.js';
import conditions from '../src/conditions.json' with {type: 'json'};

/**
 * Tests for the 'extractCondition' function of 'conditionParser.js', driven
 *   by real-world DICOM standard condition sentences stored in
 *   'conditions.json'.
 */
/** @module tests/conditionParser */

describe('extractCondition', () => {

  test.each(conditions)(
    'extracts the expected condition from: $text',
    ({text, condition}) => {
      expect(extractCondition(text).condition).toEqual(condition);
    }
  );

});
