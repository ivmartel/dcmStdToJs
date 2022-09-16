import {DicomXMLParser} from './parser.js';
import * as nema from './nema.js';

/**
 * GUI classe.
 */
export class Gui {
  /**
   * Setup the gui: bind parse button.
   */
  setup() {
    document.getElementById('parseButton').addEventListener(
      'click', onParseButtonClick);
    document.getElementById('fileupload').addEventListener(
      'change', onFileuploadChange);
  }

  /**
   * DOMContentLoaded handler: update the version select.
   */
  onDOMContentLoaded() {
    updateStandardSelect();
  }
}

/**
 * Set the progress of the progressbar.
 * @param {Event} event A progress event.
 */
function setProgress(event) {
  const progressBar = document.getElementById('progressBar');
  if (event.lengthComputable) {
    progressBar.max = event.total;
    progressBar.value = event.loaded;
  }
}

/**
 * Handle file upload change event.
 * @param {Event} event The file upload change event.
 */
function onFileuploadChange(event) {
  // enable / disable parse button if files were selected
  const parseButton = document.getElementById('parseButton');
  if (event.target.files.length !== 0) {
    parseButton.disabled = false;
  } else {
    parseButton.disabled = true;
  }
}

/**
 * Handle parse button click event.
 * @param {Event} event The parse button click event.
 */
function onParseButtonClick(event) {
  const button = event.target;

  // reset progress
  setProgress({loaded: 0, total: 100, lengthComputable: true});

  // disable button
  button.disabled = true;

  // clear output zone
  const outputDiv = document.getElementById('output');
  outputDiv.innerHTML = '';

  const parser = new DicomXMLParser();

  // parse file if provided, parse link otherwise
  const fileInputElement = document.getElementById('fileupload');
  if (fileInputElement.files.length === 1) {
    const file = fileInputElement.files[0];
    const reader = new FileReader();
    reader.onload = function (event) {
      // enable button
      button.disabled = false;
      // show tags
      const domParser = new DOMParser();
      const doc = domParser.parseFromString(
        event.target.result, 'application/xml');
      try {
        showResult(parser.parseNode(doc, file.name));
      } catch (error) {
        showError(error);
      }
    };
    reader.onprogress = setProgress;
    reader.onloadend = setProgress;
    reader.onerror = function () {
      showError('ERROR while loading data, see log for details...');
    };
    reader.readAsText(file);
  } else {
    // use selected version or default
    const dicomVersionsSelect = document.getElementById('dicomVersions');
    let selectedVersion = dicomVersionsSelect.options[
      dicomVersionsSelect.selectedIndex
    ].value;
    const dicomPartsSelect = document.getElementById('dicomParts');
    let selectedPart = dicomPartsSelect.options[
      dicomPartsSelect.selectedIndex
    ].value;

    const url = nema.getDicomPartLinks(selectedPart)[selectedVersion].xml;
    const request = new XMLHttpRequest();
    request.open('GET', url, true);
    request.responseType = 'document';
    request.overrideMimeType('text/xml'); // force xml
    request.onload = function (event) {
      // enable button
      button.disabled = false;
      // show tags
      try {
        showResult(parser.parseNode(event.target.response, url));
      } catch (error) {
        showError(error);
      }
    };
    request.onprogress = setProgress;
    request.onloadend = setProgress;
    request.onerror = function () {
      showError('ERROR while retrieving data, see log for details...');
    };
    request.send();
  }
}

/**
 * Format tags into a html element and append it to the 'output' div.
 * @param {Array} tags An array of DICOM tags.
 */
function showResult(result) {
  // append to page as text area
  if (Array.isArray(result)) {
    for (let i = 0; i < result.length; ++i) {
      appendResult('result-' + i, result[i]);
    }
  } else {
    appendResult('result-0', result);
  }
}

/**
 * Show an error result.
 */
function showError(error) {
  console.error(error);
  let message = error;
  if (typeof error.message !== 'undefined') {
    message = error.message;
  }
  appendResult('error', message);
}

/**
 * Append a text area to the ouput div.
 */
function appendResult(name, content) {
  const div = document.getElementById('output');
  let contentString = '';

  if (typeof content.name !== 'undefined') {
    const para = document.createElement('p');
    let numberOfItems;
    if (Array.isArray(content.raw)) {
      numberOfItems = content.raw.length;
    } else {
      numberOfItems = Object.keys(content.raw).length;
    }
    para.appendChild(document.createTextNode(
      content.name +
      ' (' + content.origin +
      ', ' + numberOfItems + ' items) '
    ));

    const link = document.createElement('a');
    link.download = 'result.json';
    const blob = new Blob([content.data], {type: 'text/plain'});
    link.href = window.URL.createObjectURL(blob);
    link.appendChild(document.createTextNode('download'));

    para.appendChild(link);
    div.appendChild(para);

    contentString = content.data;
  } else {
    contentString = content;
  }

  const area = document.createElement('textarea');
  area.id = name;
  area.appendChild(document.createTextNode(contentString));
  area.spellcheck = false;
  if (name.includes('error')) {
    area.className = 'error';
  } else {
    area.rows = 20;
  }

  div.appendChild(area);
}

/**
 * Update standard select with available standard versions
 */
function updateStandardSelect() {
  const versionSelect = document.getElementById('dicomVersions');

  // place holder option
  let versionOption = document.createElement('option');
  versionOption.disabled = true;
  versionOption.selected = true;
  versionOption.text = 'Select a version';
  versionOption.value = '';
  versionSelect.add(versionOption);
  // version options
  const versions = nema.getDicomVersions();
  for (let i = 0; i < versions.length; ++i) {
    versionOption = document.createElement('option');
    versionOption.text = versions[i];
    versionOption.value = versions[i];
    versionSelect.add(versionOption);
  }

  const partSelect = document.getElementById('dicomParts');

  // place holder option
  let partOption = document.createElement('option');
  partOption.disabled = true;
  partOption.selected = true;
  partOption.text = 'Select a part';
  partOption.value = '';
  partSelect.add(partOption);
  // part options
  const parts = nema.getDicomParts();
  for (let i = 0; i < parts.length; ++i) {
    partOption = document.createElement('option');
    partOption.text = parts[i];
    partOption.value = parts[i];
    partSelect.add(partOption);
  }

  const parseButton = document.getElementById('parseButton');

  // update associated links on select change
  versionSelect.onchange = function (event) {
    const part = partSelect[partSelect.selectedIndex].value;
    if (part !== '') {
      updateVersionLinks(event.target.value, part);
      parseButton.disabled = false;
    }
  };
  partSelect.onchange = function (event) {
    const version = versionSelect[versionSelect.selectedIndex].value;
    if (version !== '') {
      updateVersionLinks(version, event.target.value);
      parseButton.disabled = false;
    }
  };
}

/**
 *
 */
function updateVersionLinks(version, partNumber) {
  const links = nema.getDicomPartLinks(partNumber)[version];
  // xml standard link
  const xmlLink = document.createElement('a');
  xmlLink.href = links.xml;
  xmlLink.appendChild(document.createTextNode('xml'));
  // html standard link
  const htmlLink = document.createElement('a');
  htmlLink.href = links.html;
  htmlLink.appendChild(document.createTextNode('html'));

  const versionLinks = document.getElementById('versionLinks');
  // clear
  versionLinks.innerHTML = '';
  // add new links
  versionLinks.appendChild(document.createTextNode('(dict: '));
  versionLinks.append(xmlLink);
  versionLinks.appendChild(document.createTextNode(', '));
  versionLinks.append(htmlLink);
  versionLinks.appendChild(document.createTextNode(')'));
}
