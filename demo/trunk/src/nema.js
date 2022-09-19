// DICOM versions object
// (only those published with this repo since NEMA does not do CORS...)
const dicomVersions = {
  '2016': ['a'],
  '2018': ['a'],
  '2020': ['a'],
  '2022': ['a'],
};

const dicomParts = ['03', '05', '06', '07'];

/**
 * Get the list of DICOM standard parts.
 *
 * @returns {Array} An array of parts
 */
export function getDicomParts() {
  return dicomParts;
}

/**
 * Get the list of DICOM standard versions.
 *
 * @returns {Array} An array of versions, ordered from most recent to older.
 */
export function getDicomVersions() {
  const keys = Object.keys(dicomVersions);
  keys.sort(compare);
  // create version strings
  const versions = [];
  for (let i = 0; i < keys.length; ++i) {
    const majorVersion = keys[i];
    const minorVersions = dicomVersions[majorVersion];
    for (let j = 0; j < minorVersions.length; ++j) {
      versions.push(majorVersion + minorVersions[j]);
    }
  }
  // return
  return versions;
}

/**
 * Sort keys.
 *
 * @param {string} a First string.
 * @param {string} b Second string.
 * @returns {number} Negative is a > b.
 */
function compare(a, b) {
  return parseInt(b, 10) - parseInt(a, 10);
}

/**
 * Get a list of DICOM versions associated to their resrouce link.
 *
 * @param {string} partNumber The part number as a string.
 * @returns {Array} An array of {xml, html} objects.
 */
export function getDicomPartLinks(partNumber) {
  const versions = getDicomVersions();
  const links = {};
  for (let i = 0; i < versions.length; ++i) {
    links[versions[i]] = {
      'xml': getXmlLink(versions[i], partNumber),
      'html': getHtmlLink(versions[i], partNumber),
    };
  }
  // return
  return links;
}

/**
 * Get the xml link to the standard.
 * Links go to github since nema does not publish standard with CORS
 *
 * @param {string} version The standard version.
 * @param {string} partNumber The standard part number as a string.
 * @returns {string} The full link to the desired file.
 */
function getXmlLink(version, partNumber) {
  const githubRoot = 'https://raw.githubusercontent.com/ivmartel/dcmStdToJs/master/resources/standard';
  const partFileName = 'part' + partNumber;
  return githubRoot + '/' + version + '/' + partFileName + '.xml';
}

/**
 * Get the html link to the standard.
 *
 * @param {string} version The standard version.
 * @param {string} partNumber The standard part number as a string.
 * @returns {string} The full link to the desired html.
 */
function getHtmlLink(version, partNumber) {
  const nemaRoot = 'http://dicom.nema.org/medical/dicom';
  const partFileName = 'part' + partNumber;
  return nemaRoot + '/' + version + '/output/html/' + partFileName + '.html';
}
