// Конструктор класса MapboxConnector:
//
// Обязательные парметры:
// map - объект - карта Mapbox;
// параметры инициализации
//

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

	this.inputIcon = null;

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


MapboxConnector.prototype.ifConnected = function(input, output) {
	var res = false;
	var self = this;
	
	$.each(self.containers, function(key, value) {
		if(key == input.options.connector_id) {
			value.map(function(element) {
				if(element == output) {
					res = true;
				}
			});
		}
	});
	
	return res;
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
		if (self.inputIcon == null) {
			self.inputIcon = marker.options.icon;
		}
		marker.options.connector_id = this.id;

		marker.on('click', function() {
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
MapboxConnector.prototype.findClosest = function(latlgn, output) {
	var point = this.map._latLngToNewLayerPoint(latlgn, this.map.getZoom(), this.map.getCenter());
	
	for(var key in this.connections) {
		var connection = this.connections[key];
		if(connection['type'] == 'input') {
			var markerPoint = this.map._latLngToNewLayerPoint(connection['marker'].getLatLng(), this.map.getZoom(), this.map.getCenter());

			var d = connection['marker'].options.icon.options.iconSize[0];
			var x1 = markerPoint.x + d / 2.0;
			var x2 = markerPoint.x - d / 2.0;

			var y1 = markerPoint.y + d / 2.0;
			var y2 = markerPoint.y - d / 2.0;

			if(point.x < x1 && point.x > x2 && point.y < y1 && point.y > y2) {
				if(this.dragged) {
					if( !this.ifConnected(connection['marker'], output)) {
						connection['marker'].setIcon(this.inputHoverIcon);
						this.dropEnabled = true;
						this.dropId = connection['marker'].options.connector_id;
					}
				}
				break;
			}
			else {
				if(this.dragged) {
					this.dropEnabled = false;
					connection['marker'].setIcon(this.inputIcon);
				}
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
			connector_id: self.id,
			opacity: 0
		});
		
		var dragLineOptions = {
			color: this.connectionLineColor,
			weight: this.connectionLineWeight,
			connector_id: this.id
		};

		marker.on("mouseover", function() {
			self.connections[this.options.connector_id]['connectionMarker'].setOpacity(1.0);
		}).on("mouseout", function() {
			self.connections[this.options.connector_id]['connectionMarker'].setOpacity(0.0);
		});

		connectionMarker.bindPopup(self.connectorPointPopUpMessage);
		connectionMarker.addTo(self.map).on('dragstart', function() {
			self.dragged = true;
			self.draggedId = this.options.connector_id;
		}).on('drag', function(e) {
			var id = this.options.connector_id;
			var connection = self.connections[id];
			var path = connection['dragLine'].getLatLngs();
			self.findClosest(path[1], connection['marker']);
		}).on('dragend', function(e) {
			self.dragged = false;
			self.draggedId = -1;
			var id = this.options.connector_id;
			var connection = self.connections[id];
			
			var newLatLng = null;
			var opacity = 1;
			var path = connection['dragLine'].getLatLngs();

			if(self.dropEnabled) {
				opacity = 0;
				self.dropEnabled = false;
				newLatLng = self.connections[self.dropId]['marker'].getLatLng();

				self.connections[self.dropId]['marker'].setIcon(self.inputIcon);
				
				
				if( !self.ifConnected(self.connections[self.dropId]['marker'], connection['marker'])) {
					// добавление линии соединения на карту
					var points = path;
					points[1] = newLatLng;
					
					var connectLine = L.polyline(points, dragLineOptions).addTo(self.map);
					connectLine.options.container_id = self.dropId;
					connectLine.on('click', function() {
						var connection = self.connections[this.options.connector_id];
						var containerId = this.options.container_id;
						$.each(self.containers, function(key, value) {
							if(containerId == key) {
								value.map(function(element) {
									if(element == connection['marker']) {
										var index = value.indexOf(element);
										if (index > -1) {
											value.splice(index, 1);
										}
									}
								});
							}
						});
						
						self.map.removeLayer(this);
					});

					// добавление в список привязанных контейнеров
					if (self.dropId in self.containers) {
						self.containers[self.dropId].push(connection['marker']);
					}
					else {
						self.containers[self.dropId] = [connection['marker']];
					}
				}
			} else {
				newLatLng = connection['marker'].getLatLng();
				var tmp = connection['connectionMarker'];
				setTimeout( function() {
					tmp.setOpacity(0.0);
				}, 100);
			}
			
			connection['connectionMarker'].setLatLng(connection['marker'].getLatLng());
			connection['connectionMarker'].setOpacity(opacity);
			
			path[1] = connection['marker'].getLatLng();
			connection['dragLine'].setLatLngs(path);

			for(var key in self.connections) {
				var connection = self.connections[key];
				if(connection['type'] == 'input') {
					connection['marker'].setIcon(self.inputIcon);
				}
			}		
		}).on('mouseover', function() {
			if(!self.dragged) {
				this.openPopup();
				this.setOpacity(1.0);
			}
		}).on('mouseout', function() {
			this.closePopup();
			this.setOpacity(0.0);
		});
		
		
		
		
		var line_points = [
			marker.getLatLng(),
			marker.getLatLng()
		];

		// Defining a polygon here instead of a polyline will connect the
		// endpoints and fill the path.
		// http://leafletjs.com/reference.html#polygon
		var dragLine = L.polyline(line_points, dragLineOptions).addTo(this.map);
		dragLine.options.connector_id = this.id;

		
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

	connectorPointPopUpMessage: "string",

	inputHoverIcon: "object"
}


