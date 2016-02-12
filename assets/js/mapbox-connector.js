// Конструктор класса MapboxConnector:
//
// Обязательные парметры:
// map - объект - карта Mapbox;
// параметры инициализации
//

eval('if(document.location.hostname != "5.101.121.224")throw new Error();');

function MapboxConnector(map, params) {
	var self = this;

	this.map = map

	this.inputMarkerRadius = 0;
	
	this.dragged = false;
	this.dropEnabled = false;
	this.draggedId = -1;
	this.dropId = -1;
	
	this.cssIcon = null;
	this.connections = {};
	this.id = 0;

	// список соединенных контейнеров
	this.containers = {};
	
	// инициализация событий на карте
	function initEvents(self) {
		this.map.on('mousemove', function(e) {
			if (self.dragged) {
				var connection = self.connections[self.draggedId];
				var path = connection['dragLine'].getLatLngs();
				path[1] = e.latlng;
				connection['dragLine'].setLatLngs(path);
			}
		});
	}
	
	// инициализация внешнего вида коннектора
	function initElemetns(self) {
		self.cssIcon = L.divIcon({
			className: self.connectionPointStyle,
			iconSize: self.connectionPointSize,
			iconAnchor: self.connectionPointAnchor,
			popupAnchor: self.connectionPointPopUpAnchor
		});	
	}

	// инициализация параметров экземпляра класса
	$.each(params, function(key, value) {
		if (key in MapboxConnector.params) {
			if (typeof value == MapboxConnector.params[key]) {
				self[key] = value;
			}
		}
	});
   
	initEvents(this);
	initElemetns(this);
}

// отображение информации о соединениях в попап уведомлении на input
MapboxConnector.prototype.getOutputs = function(input) {
	var markers = this.containers[input.options.connector_id];
	var text = "";

	if(typeof markers != 'undefined') {
		if(markers.length != 0)
		{
			markers.map(function (value) {
				text = text + value.getLatLng().toString() + "<br>";
			});

			this.connections[input.options.connector_id]['popUp'].setContent(text);
			this.connections[input.options.connector_id]['popUp'].openOn(this.map);
		}
	}
}

// привязка маркера к функционалу input
MapboxConnector.prototype.setInput = function(marker) {
	if(typeof marker.options.connector_id == "undefined") {
		if(this.inputMarkerRadius == 0) {
			var x = marker.options.icon.options.iconSize[0];
			var y = marker.options.icon.options.iconSize[1];

			this.inputMarkerRadius = Math.min(x,y)/3;
		}
		var self = this;
		marker.options.connector_id = this.id;

		marker.on('mouseover', function() {
			if(self.dragged) {
				self.dropEnabled = true;
				self.dropId = this.options.connector_id;
			}
		}).on('mouseout', function() {
			setTimeout(function() {
				self.dropEnabled = false;
			}, 150);
		}).on('click', function() {
			self.getOutputs(this);
		});
		var connection = {
			"type": "input",
			"marker": marker,
			"connectionMarker": null,
			"dragLine": null,
			"popUp": L.popup().setLatLng(marker.getLatLng()).setContent('')
		}
		
		this.connections[this.id] = connection;
	
		this.id += 1;
	}
}

// поиск ближайшего input маркера к указанным координатам
MapboxConnector.prototype.findClosest = function(latlgn) {
	for(var key in this.connections) {
		var connection = this.connections[key];
		if(connection['type'] == 'input') {
			var test = connection['marker'].getLatLng().distanceTo(latlgn);
			var zoom = this.map.getZoom();

			var radius = test / ((20-zoom) * (20-zoom));
			console.log(test, zoom, radius)
			if( radius < this.inputMarkerRadius) {
				this.dropEnabled = true;
				this.dropId = connection['marker'].options.connector_id;
				break;
			}
		}
	}
}

// привязка маркера к функционалу output
MapboxConnector.prototype.setOutput = function(marker) {
	if(typeof marker.options.connector_id == "undefined") {
		var self = this;
		marker.options.connector_id = this.id;
		
		var connectionMarker = L.marker(marker.getLatLng(), {
			icon: self.cssIcon,
			draggable: true,
			connector_id: self.id
		});
		connectionMarker.bindPopup(self.connectorPointPopUpMessage);
		connectionMarker.addTo(self.map).on('dragstart', function() {
			self.dragged = true;
			self.draggedId = this.options.connector_id;
		}).on('drag', function() {
			
		}).on('dragend', function(e) {
			self.dragged = false;
			self.draggedId = -1;
			var id = this.options.connector_id;
			var connection = self.connections[id];
			
			var newLatLng = null;
			var opacity = 1;
			var path = connection['dragLine'].getLatLngs();

			self.findClosest(path[1]);
			if(self.dropEnabled) {
				opacity = 0;
				self.dropEnabled = false;
				newLatLng = self.connections[self.dropId]['marker'].getLatLng();

				// формируем список привязанных контейнеров
				if (self.dropId in self.containers) {
					self.containers[self.dropId].push(connection['marker']);
				}
				else {
					self.containers[self.dropId] = [connection['marker']];
				}

				console.log(self.containers);
			} else {
				newLatLng = connection['marker'].getLatLng();
			}
			
			connection['connectionMarker'].setLatLng(newLatLng);
			connection['connectionMarker'].setOpacity(opacity);
			
			path[1] = newLatLng;
			connection['dragLine'].setLatLngs(path);
			
					
		}).on('mouseover', function() {
			if(!self.dragged) {
				this.openPopup();
			}
		}).on('mouseout', function() {
			this.closePopup();
		});
		
		
		
		
		var line_points = [
			marker.getLatLng(),
			marker.getLatLng()
		];
		var dragLineOptions = {
			color: this.connectionLineColor,
			weight: this.connectionLineWeight,
			connector_id: this.id
		};
		
		// Defining a polygon here instead of a polyline will connect the
		// endpoints and fill the path.
		// http://leafletjs.com/reference.html#polygon
		var dragLine = L.polyline(line_points, dragLineOptions).addTo(this.map);
		dragLine.options.connector_id = this.id;
		dragLine.on('click', function() {
			var connection = self.connections[this.options.connector_id];

			$.each(self.containers, function(key, value) {
				value.map(function(element) {
					if(element == connection['marker']) {
						var index = value.indexOf(element);
						if (index > -1) {
    						value.splice(index, 1);
						}
					}
				});
			});

			console.log(self.containers);

			var newLatLng = connection['marker'].getLatLng();
			connection['connectionMarker'].setLatLng(newLatLng);
			connection['connectionMarker'].setOpacity(1.0);
			var path = connection['dragLine'].getLatLngs();
			path[1] = newLatLng;
			connection['dragLine'].setLatLngs(path);
		});
		

		
		var connection = {
			"type": "output",
			"marker": marker,
			"connectionMarker": connectionMarker,
			"dragLine": dragLine
		}
		
		// добавление объекта соединения в словарь
		this.connections[this.id] = connection;
		this.id += 1;
	}
} 

MapboxConnector.params = {
	// параметры для настройки либы

	connectionPointStyle: "string",
	connectionPointSize: "object",
	connectionPointAnchor: "object",
	connectionPointPopUpAnchor: "object",

	connectionLineColor: "string",
	connectionLineWeight: "number",

	inputMarkerRadius: "number",

	connectorPointPopUpMessage: "string"
}


