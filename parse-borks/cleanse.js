var fs = require('fs');
var _ = require('lodash');

var tempJsonDelimiter = '&&&&&&';
var fileCount = 26;

function parseHeader(rawHeader) {
  return rawHeader.replace(/"| /g, '').split(',');
} 

function parseJsonRow(chunk, depthString) {
  var string = chunk.replace(/"/g, '');
  if (/[0-9]+:/.test(string)) {
    var chapterString = string.match(/(Chapter [0-9]+)/)[0];
    string = string.replace(/(?:[0-9]+):/, '-').replace('Chapter', chapterString);
    if (!/:/.test(string)) return false;
  }

  var jsonChunks = string.split(':');
  var length = jsonChunks.length;
  var maxId = length - 1;
  var key;
  var value;

  if (length > 2) {
    depthString += jsonChunks[0] + tempJsonDelimiter;
  }
  key = depthString + jsonChunks[maxId - 1].replace(/{|}/g, '');
  value = jsonChunks[maxId];

  if (value.includes('}')) {
    var count = value.match(/}/g).length;
    var depthParts = depthString.split(tempJsonDelimiter);
    for (var i = count-1; i >= 0; i--) {
      depthParts.splice(i, 1);
    }
    depthString = depthParts.join(tempJsonDelimiter);
  }
  return {
    depthString: depthString,
    key: key,
    value: value.replace(/{|}/g, ''),
  }
}

function reinflateJsonObject(flat) {
  var returnObject = {};
  for (var i in flat) {
    if (i.includes(tempJsonDelimiter)) {
      var keys = i.split(tempJsonDelimiter);
      _.set(returnObject, keys, flat[i]);
    } else {
      returnObject[i] = flat[i];
    }
  }
  return returnObject;
}

function parseRow(rawRow) {
  var chunks = rawRow.split(',');
  var jsonThings = {};
  var regularThings = [];
  var jsonIndex = null;
  var depthString = '';
  for (var i in chunks) {
    var chunk = chunks[i];
    if (chunk.includes(':') && /[a-zA-Z]/.test(chunk)) {
      if (jsonIndex === null) {
        jsonIndex = i;
        regularThings.push({});
      }

      if (chunk.includes('Post-Convo Survey: Issue Tagging')) chunk = chunk.replace('Survey:', 'Survey -');
      if (chunk.includes(':')) {
        var parsed = parseJsonRow(chunk, depthString);
        if (!parsed) continue;
        depthString = parsed['depthString'];
        jsonThings[parsed['key']] = parsed['value'];
      }
    } else {
      regularThings.push(chunk.replace(/"|\\|'/g, '').replace(/\[/g, '[""').replace(/\]/g,'""]'));
    }
  }

  regularThings[jsonIndex] = JSON.stringify(reinflateJsonObject(jsonThings)).replace(/"/g,'""');
  return regularThings;
}

function flattenLine(lineArray) {
  return _.map(lineArray, function (el) {return '"' + el + '"';}).join(',') + '\r';
}


for (var i = 1; i <= fileCount; i++) {
  var input = './source/' + i + '.csv';
  var fileData = fs.readFileSync(input, 'utf8');
  var fileLines = fileData.split('\r');
  var output = './output/' + i + '.csv';

  if (fs.existsSync(output)) {
    fs.unlinkSync(output);
  }

  var header = parseHeader(fileLines[0]);
  fs.appendFileSync(output, flattenLine(header));

  for (var j = 1; j < fileLines.length; j++) {
    var row = parseRow(fileLines[j]);
    fs.appendFileSync(output, flattenLine(row));
  }
  console.log('File ' + i + ' is cleaned up!');
}

