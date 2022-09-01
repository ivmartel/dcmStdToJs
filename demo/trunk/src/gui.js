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
      'click', onParseButton);
  }

  /**
   * DOMContentLoaded handler: update the version select.
   */
  onDOMContentLoaded() {
    updateVersionSelect();
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
 * Load selected file or link.
 * @param {Event} event The parse button click event.
 */
function onParseButton(event) {
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
    const defaultVersion = '2019a';
    if (selectedVersion.length === 0) {
      selectedVersion = defaultVersion;
    }

    const url = nema.getDicomPart06Links()[selectedVersion].xml;
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
 * Update version select with available standard versions
 */
function updateVersionSelect() {
  const versionSelect = document.getElementById('dicomVersions');

  // place holder option
  let option = document.createElement('option');
  option.disabled = true;
  option.selected = true;
  option.text = 'Select a version';
  option.value = '';
  versionSelect.add(option);
  // version options
  const versions = nema.getDicomVersions();
  for (let i = 0; i < versions.length; ++i) {
    option = document.createElement('option');
    option.text = versions[i];
    option.value = versions[i];
    versionSelect.add(option);
  }

  // update associated links on select change
  versionSelect.onchange = function (event) {
    updateVersionLinks(event.target.value);
  };
}

/**
 *
 */
function updateVersionLinks(version) {
  const links = nema.getDicomPart06Links()[version];
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
  versionLinks.appendChild(document.createTextNode('(dict (part06): '));
  versionLinks.append(xmlLink);
  versionLinks.appendChild(document.createTextNode(', '));
  versionLinks.append(htmlLink);
  versionLinks.appendChild(document.createTextNode(')'));
}
