var self = this;

/**
 * mimeTypeAccepted
 * @type {Array}
 */
var mimeTypeAccepted = [
	'application/vnd.ms-excel',
	'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
];

/**
 * step
 * @type {Number}
 */
this.step = 1;

/**
 * files
 * @type {Array}
 */
this.files = [];

/******************************************************************************************
 * NEXT AND PREVIEW BUTTON
 ******************************************************************************************/

/**
 * next
 */
this.next = function () {
	if (this.step === 1) {
		// Check if all file to import have a resource
		var okForNext = true
		self.files.forEach(function (file) { if (!file.resource) okForNext = false; });
		if (!okForNext) {
			self.messageType = 'error';
			self.modalTitle = 'Resource is required';
			self.modalMessage = 'Please, choose a resource for each file to import';
			return self.showModal = true;
		}
	}

	if (this.step < 4) this.step++;

	if (this.step === 2) {
		return readFiles(function (lines, fileId, resource) {
			var objet = { id: fileId, lines: lines, resource: resource };
			self.linesPerFile.push(objet);
		});
	}
};

/**
 * preview
 */
this.preview = function () {
	if (this.step > 1) return this.step--;
};

/**
 * disabledNextOrPrevBtn
 */
this.disabledNextOrPrevBtn = function (btn) {
	if (btn === 'next') {
		return this.step === 4  || !this.files.length || (this.step === 2 && !Object.keys(this.resultsMap).length)
	}

	if (btn === 'prev') {
		return this.step === 1;
	}
};

/******************************************************************************************
 * STEP ONE
 ******************************************************************************************/

/**
 * handleFileSelect
 * @param evt
 */
var handleFileSelect = function (evt) {
	evt.stopPropagation();
	evt.preventDefault();

	// files is a FileList of File objects. List some properties.
	var files = evt.dataTransfer.files; // FileList object.
	for (var i = 0; i < files.length; i++) {
		if (mimeTypeAccepted.indexOf(files[i].type) === -1) return;
		self.files.push(files[i]);
	};
}

/**
 * handleDragOver
 * @param evt
 */
var handleDragOver = function (evt) {
	evt.stopPropagation();
	evt.preventDefault();
	evt.dataTransfer.dropEffect = 'copy'; // Explicitly show this is a copy.
}

/**
 * Setup the drag and drop listeners.
 */
setTimeout(function () {
	var dropZone = document.getElementById('my-drop-zone');
	dropZone.addEventListener('dragover', handleDragOver, false);
	dropZone.addEventListener('drop', handleFileSelect, false);
}, 1);

/**
 * SetId
 * @param {Number}
 * @param {Object}
 */
this.setId = function (i, item) {
	item.id = i;
	return i;
}

/**
 * Remove file
 * @type {Number}
 */
this.removeFile = function (index) { this.files.splice(index, 1); }

/**
 *
 */
this.seeSchema = function (resource) {
	this.messageType = 'info';
	this.modalTitle = 'Property';
	this.showModal = true;

	var resources = self.customData.config.resources;
	this.schemaProperty = resources.filter(function (schema) { return resource === schema.name });
	this.schemaProperty = this.schemaProperty[0] ? JSON.stringify(JSON.parse(this.schemaProperty[0].jsonSchema), null, 2) : '';
}

/******************************************************************************************
 * STEP TWO
 ******************************************************************************************/

/**
 * linesPerFile
 * @type {Array}
 */
this.linesPerFile = [];

/**
 * Who contains the schema per ressource
 * @type {Array} contacts
 * @type {Array} deals
 * @type {Array} leads
 */
this.schemas = [];

/**
 * Who contains the results after mapping for all files
 * @type {Object} resultsMap
 */
this.resultsMap = {};

/**
 * generateSchema
 * @param {Object} params
 */
(function () {
	var allResources = self.customData.config.resources;

	var forEachObject = function (data, callback) {
		for (var key in data) {
			callback(data[key], key)
		}
	};

	allResources.forEach(function (resource) {
		var jsonSchema = JSON.parse(resource.jsonSchema);
		var schemaGenerated = { core: resource.name, schema: [] };

		var setValue = function (data, key, isArray) {
			forEachObject(data, function (subValue, subKey) {
				var newSchema = {};
				if (typeof subValue !== 'string' && !Array.isArray(subValue)) {
					newSchema = {
						title: isArray ? key + '-' + subKey : subKey ,
						field: key + '.' + subKey
					};
					schemaGenerated.schema.push(newSchema);
				}
			});
		};

		forEachObject(jsonSchema, function (value, key) {
			if (Array.isArray(value)) {
				value.forEach(function (data) {
					setValue(data, key, true)
				});
			} else if (value.hasOwnProperty('sectionTitle')) {
				setValue(value, key);
			} else {
				var newSchema = {};
				newSchema.title = newSchema.field = key;
				schemaGenerated.schema.push(newSchema);
			}
		});

		self.schemas.push(schemaGenerated);
	});
})();

/**
 * readFile
 *
 * This function is called by the `next` function
 * Read file and stock his content in localStorage
 * @param callback
 */
var readFiles = function (callback) {
	self.files.forEach(function (file) {
		var reader = new FileReader();
		reader.onload = (function (event) {
			var lines = [];
			var csv = event.target.result.split(/\r\n|\n/);
			while (csv.length) { lines.push(csv.shift().split(',')); }
			return callback(lines, file.id, file.resource);
		});
		return reader.readAsText(file);
	});
};

/**
 * Select file to map
 * @param {String}
 */
this.onChangeFile = function (idOfFileSelected) {
	this.fileLine = this.linesPerFile.filter(function (fileLine) { return fileLine.id === Number(idOfFileSelected); });
	this.linesHeader = this.fileLine[0].lines[0];

	var fileResource = this.fileLine[0].resource;
	this.currentSchema = this.schemas.filter(function (schema) { return fileResource === schema.core });
	this.currentSchema = this.currentSchema[0].schema;
	this.autoDragAndDrop(idOfFileSelected);
}

/**
 * Drag and Drop for mapping step
 */
this.dragOver = function (event) { event.preventDefault(); }
this.drag = function (event) { event.dataTransfer.setData('elem', event.target.id); }
this.drop = function (event, propertyArea) {
	event.preventDefault();
	var data = event.dataTransfer.getData('elem');
	if (!propertyArea) return event.target.appendChild(document.getElementById(data));

	var targetId = document.getElementById(data).id + '-drop';
	var trTag = document.getElementById(targetId);
	var dataToAppend = document.getElementById(data);
	return trTag.appendChild(dataToAppend);
}

/**
 * autoDragAndDrop
 * @param {String} idOfFileSelected
 */
this.autoDragAndDrop = function (idOfFileSelected) {

	var initResultsMap = setInterval(function () {
		var resultsMapElem = document.getElementById('resultsMap');
		var resultsMapTrElems = resultsMapElem.children;
		if (resultsMapTrElems) {
			clearInterval(initResultsMap);

			// Making empty the `Preview information` column
			for (var i = 0; i <= resultsMapTrElems.length; i++) {
				if (resultsMapTrElems[i]) resultsMapTrElems[i].children[1].innerHTML = '';
			}

			// Automatically set up the `Preview information` already parametered by the user
			var resultMap = self.resultsMap[idOfFileSelected];
			var resultMapData = resultMap ? resultMap.data : '';
			if (resultMapData) {
				resultMapData.forEach(function (data, key) {
					var elemTitle = document.getElementById('drag-' + data.title);
					var headerTitle = document.getElementById('drop-' + data.header);
					headerTitle.parentNode.childNodes[3].appendChild(elemTitle);
				});
			}
		}
	}, 30);
}

/**
 * searchColForAccounts
 * @param {String} idOfFileSelected
 * @param {Function} cb
 */
var searchColForAccounts = function (idOfFileSelected, cb) {
	var fileId = Number(idOfFileSelected);
	var lists = ['organisation_name', 'organisation', 'company', 'company_name', 'administration', 'administration_name'];
	self.linesPerFile.forEach(function (file) {
		if (file.id === fileId) {
			var colHeaders = file.lines[0];
			colHeaders.forEach(function (colHead, key) {
				if (lists.indexOf(colHead) !== -1) {
					generateData(file.lines, key, idOfFileSelected);
					return cb(colHead, key);
				}
			});
		}
	})
};

/**
 * Save mapping for the file selected
 * @param {String} idOfFileSelected
 */
this.saveMapping = function (idOfFileSelected) {
	var resultMap = document.getElementById('resultsMap');
	var resultMapTrTag = resultMap.children;
	var finalMapping = [];

	for (var i = 0; i <= resultMapTrTag.length; i++) {
		if (resultMapTrTag[i]) {
			var oldHeader = resultMapTrTag[i].children[0].innerText;
			var newHeader = resultMapTrTag[i].children[1].innerText;
			if (newHeader) {
				var schemaField = resultMapTrTag[i].children[1].children[0].children[0].innerHTML;
				var obj = { header: oldHeader, title: newHeader, schemaField: schemaField, col: i };
				finalMapping.push(obj);
			}
		}
	}

	if (!self.resultsMap[idOfFileSelected]) self.resultsMap[idOfFileSelected] = {};
	self.resultsMap[idOfFileSelected] = { id: Number(idOfFileSelected), data: finalMapping };

	searchColForAccounts(idOfFileSelected, function (colHead, key) {
		if (colHead) self.resultsMap[idOfFileSelected].accountCol = { title: colHead, col: key };
	});
}

/**
 * generateData
 * @param {Array} lines
 * @param {Number} col
 */
var generateData = function (lines, col, idOfFileSelected) {
	// Find accounts column value
	var accountsColValue = lines.map(function (line, key) { return line[col]; });
	var accounts = accountsColValue.filter(function (line, key) { return line && key !== 0 });

	// Find cols value for the col mapped
	for (var i in self.resultsMap) {
		if (self.resultsMap[i].id === Number(idOfFileSelected)) {
			var newValue = self.resultsMap[i].data.map(function (colMap) {
				var colValue = lines.map(function (column, key) { return column[colMap.col]; });
				colMap.colValues = colValue;
				return colMap;
			});

			// Create document
			var documents = [];
			newValue.forEach(function (col, key) {
				col.colValues.forEach(function (celluleValue, key) {
					var doc = {};
					var property = col.schemaField.trim();

					if (celluleValue && celluleValue !== '""') {
						doc[property] = celluleValue;
						if (!documents[key]) documents.push(doc);
						documents[key][property] = celluleValue;
					} else {
						if (!documents[key]) documents.push(doc);
					}
				});

				if (newValue.length - 1 === key) {
					self.messageType = 'info';
					self.modalTitle = 'Viewer';

					self.viewerDataHeader = [];
					self.viewerDataProperty = [];
					for (var i in documents[0]) {
						self.viewerDataHeader.push(documents[0][i]);
						self.viewerDataProperty.push(i);
					};

					self.viewerDataContents = documents.filter(function(data, key) { return key !== 0 });
					return self.showModal = true;
				}
			});
		}
	}
};

