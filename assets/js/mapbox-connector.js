// Конструктор класса MapboxConnector:
//
// Обязательные парметры:
// map - инстанс карты Mapbox;
// 
//
function MapboxConnector(map, params) {
	var self = this;
	this.map = map
	
	this.dragged = false;
	this.dropEnabled = false;
	this.draggedId = -1;
	this.dropId = -1;
	
	this.cssIcon = null;
	this.connections = {};
	this.id = 0;
	
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
	
	function initElemetns(self) {
		self.cssIcon = L.divIcon({
			// Имя класса CSS
			className: 'css-icon',
			// Установка размера маркера
			iconSize: [8, 8],
			iconAnchor: [14, 4],
			popupAnchor: [-10, -4]
		});	
	} 



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


MapboxConnector.prototype.setInput = function(marker) {
	if(typeof marker.options.connector_id == "undefined") {
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
		});
		
		
		var connection = {
			"type": "input",
			"marker": marker,
			"connectionMarker": null,
			"dragLine": null
		}
		
		this.connections[this.id] = connection;
	
		this.id += 1;
	}
} 

MapboxConnector.prototype.findClosest = function(latlgn) {
	for(var key in this.connections) {
		var connection = this.connections[key];
		if(connection['type'] == 'input') {
			var test = connection['marker'].getLatLng().distanceTo(latlgn);
			var zoom = this.map.getZoom();

			var radius = test / ((20-zoom) * (20-zoom));
			console.log(test, zoom, radius)
			if( radius < 8.0) {
				this.dropEnabled = true;
				this.dropId = connection['marker'].options.connector_id;
				break;
			}
		}
	}
}

MapboxConnector.prototype.setOutput = function(marker) {
	if(typeof marker.options.connector_id == "undefined") {
		var self = this;
		marker.options.connector_id = this.id;
		
		var connectionMarker = L.marker(marker.getLatLng(), {
			icon: self.cssIcon,
			draggable: true,
			connector_id: self.id
		});
		connectionMarker.bindPopup('Left click to connect.');
		connectionMarker.addTo(self.map).on('dragstart', function() {
			console.log('drag');
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
			} else {

				newLatLng = connection['marker'].getLatLng();
			}
			
			connection['connectionMarker'].setLatLng(newLatLng);
			connection['connectionMarker'].setOpacity(opacity);
			
			//var path = connection['dragLine'].getLatLngs();
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
			color: 'orange',
			connector_id: this.id
		};
		
		// Defining a polygon here instead of a polyline will connect the
		// endpoints and fill the path.
		// http://leafletjs.com/reference.html#polygon
		var dragLine = L.polyline(line_points, dragLineOptions).addTo(this.map);
		dragLine.options.connector_id = this.id;
		dragLine.on('click', function() {
			var connection = self.connections[this.options.connector_id];
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
		
		
		
		//Добавление объекта соединения в словарь 
		this.connections[this.id] = connection;
		this.id += 1;
	}
} 

MapboxConnector.params = {
	test: "string"
}


