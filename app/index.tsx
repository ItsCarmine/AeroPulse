import React, { useState, useEffect } from 'react';
import { StyleSheet, View, Dimensions, TouchableOpacity, Text, ScrollView, Modal, Image } from 'react-native';
import MapView, { Marker, Overlay, UrlTile } from 'react-native-maps';
import axios from 'axios';
import * as Location from 'expo-location';
import * as Notifications from 'expo-notifications';
import { Ionicons } from '@expo/vector-icons';

interface LayerConfig {
  id: string;
  name: string;
  gridLayer: string;
}

interface MapStyleConfig {
  id: string;
  name: string;
  style: any[];
}

// Define the map styles
const MAP_STYLES: MapStyleConfig[] = [
  {
    id: 'default',
    name: 'Default',
    style: [], 
  },
  {
    id: 'terrain',
    name: 'Terrain',
    style: [
      {
        featureType: 'all',
        elementType: 'all',
        stylers: [{ visibility: 'on' }],
      },
      {
        featureType: 'landscape.natural',
        elementType: 'geometry.fill',
        stylers: [{ color: '#dde2e3' }],
      },
      {
        featureType: 'poi.park',
        elementType: 'geometry.fill',
        stylers: [{ color: '#c8e6c9' }],
      },
      {
        featureType: 'road',
        elementType: 'geometry',
        stylers: [{ color: '#f5f1e6' }],
      },
      {
        featureType: 'water',
        elementType: 'geometry.fill',
        stylers: [{ color: '#b0d5ff' }],
      },
    ],
  },
];


const AVAILABLE_LAYERS: LayerConfig[] = [
  { id: '30-31', name: '30-31 kft', gridLayer: 'turb-grid-30-31-kft' },
  { id: '32-33', name: '32-33 kft', gridLayer: 'turb-grid-32-33-kft' },
  { id: '34-35', name: '34-35 kft', gridLayer: 'turb-grid-34-35-kft' },
  { id: '36-37', name: '36-37 kft', gridLayer: 'turb-grid-36-37-kft' },
  { id: '38-39', name: '38-39 kft', gridLayer: 'turb-grid-38-39-kft' },
  { id: '40-41', name: '40-41 kft', gridLayer: 'turb-grid-40-41-kft' },
  { id: 'max', name: 'Max Value', gridLayer: 'turb-grid-Max-Value-30-41-kft' },
];

// Add this custom map style configuration
const mapStyle = [
  {
    "elementType": "geometry",
    "stylers": [
      {
        "color": "#f5f5f5"
      }
    ]
  },
  {
    "elementType": "labels.icon",
    "stylers": [
      {
        "visibility": "off"
      }
    ]
  },
  {
    "elementType": "labels.text.fill",
    "stylers": [
      {
        "color": "#616161"
      }
    ]
  },
  {
    "elementType": "labels.text.stroke",
    "stylers": [
      {
        "color": "#f5f5f5"
      }
    ]
  },
  {
    "featureType": "administrative.land_parcel",
    "stylers": [
      {
        "visibility": "off"
      }
    ]
  },
  {
    "featureType": "administrative.land_parcel",
    "elementType": "labels.text.fill",
    "stylers": [
      {
        "color": "#bdbdbd"
      }
    ]
  },
  {
    "featureType": "water",
    "elementType": "geometry",
    "stylers": [
      {
        "color": "#e9e9e9"
      }
    ]
  },
  {
    "featureType": "water",
    "elementType": "labels.text.fill",
    "stylers": [
      {
        "color": "#9e9e9e"
      }
    ]
  }
];

export default function Home() {
  const [isLocationEnabled, setIsLocationEnabled] = useState(true);
  const [selectedLayer, setSelectedLayer] = useState<LayerConfig>(AVAILABLE_LAYERS[0]);
  const [availableTimes, setAvailableTimes] = useState<string[]>([]);
  const [selectedTime, setSelectedTime] = useState<string>('');
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showGridLayer, setShowGridLayer] = useState(true);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [groupedTimes, setGroupedTimes] = useState<{ [key: string]: string[] }>({});
  const [currentLocation, setCurrentLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [customLocation, setCustomLocation] = useState<{ latitude: number; longitude: number } | null>(null);

  const [showAboutModal, setShowAboutModal] = useState(false);
  const [selectedMapStyle, setSelectedMapStyle] = useState<MapStyleConfig>(MAP_STYLES[0]);

  const requestLocationPermission = async () => {
    try {
      if (!isLocationEnabled) {
        setCurrentLocation(null);
        return;
      }
  
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === 'granted') {
        Location.watchPositionAsync(
          {
            accuracy: Location.Accuracy.High,
            timeInterval: 1000,
            distanceInterval: 1,
          },
          (location) => {
            setCurrentLocation({
              latitude: location.coords.latitude,
              longitude: location.coords.longitude,
            });
          }
        );
      }
    } catch (err) {
      console.warn('Location permission error:', err);
    }
  };
  
  useEffect(() => {
    requestLocationPermission();
  }, [isLocationEnabled]);

  useEffect(() => {
    if (availableTimes.length > 0) {
      const grouped = availableTimes.reduce((acc, time) => {
        const date = time.substring(0, 8);
        if (!acc[date]) {
          acc[date] = [];
        }
        acc[date].push(time);
        return acc;
      }, {} as { [key: string]: string[] });

      const sortedDates = Object.keys(grouped).sort((a, b) => parseInt(b) - parseInt(a));
      const sortedGrouped: { [key: string]: string[] } = {};

      sortedDates.forEach((date) => {
        sortedGrouped[date] = grouped[date].sort((a, b) => parseInt(b.substring(9)) - parseInt(a.substring(9)));
      });

      setGroupedTimes(sortedGrouped);
      setSelectedDate(sortedDates[0]);
    }
  }, [availableTimes]);

  // Fetch times for the selected layer
  const fetchTimes = async () => {
    try {
      const productId = selectedLayer.gridLayer;
      const url = `https://realearth.ssec.wisc.edu/api/times?products=${productId}`;
      const response = await axios.get(url);

      if (response.data && response.data[productId]) {
        const times: string[] = response.data[productId];
        setAvailableTimes(times);

        if (times.length > 0) {
          const latestTime = times[times.length - 1];
          setSelectedTime(latestTime);
        }
      } else {
        console.warn('No times data available for the selected layer.');
        setAvailableTimes([]);
      }
    } catch (error) {
      console.error('Error fetching times:', error);
    }
  };

  const handleMapPress = (event: any) => {
    const { latitude, longitude } = event.nativeEvent.coordinate;
    setCustomLocation({ latitude, longitude });
  };

  // Reset states when the selected layer changes
  useEffect(() => {
    setShowDatePicker(false);
    setAvailableTimes([]);
    setGroupedTimes({});
    setSelectedDate(null);
    fetchTimes();
  }, [selectedLayer]);

  // Format functions
  const formatTime = (timeString: string) => {
    const year = timeString.substring(0, 4);
    const month = timeString.substring(4, 6);
    const day = timeString.substring(6, 8);
    const hour = timeString.substring(9, 11);
    const minute = timeString.substring(11, 13);
    return `${year}-${month}-${day} ${hour}:${minute} UTC`;
  };

  const formatDate = (dateString: string) => {
    const year = dateString.substring(0, 4);
    const month = dateString.substring(4, 6);
    const day = dateString.substring(6, 8);
    return `${year}-${month}-${day}`;
  };

  const AboutModal = () => (
    <Modal
      visible={showAboutModal}
      transparent={true}
      animationType="slide"
      onRequestClose={() => setShowAboutModal(false)}
    >
      <TouchableOpacity
        style={styles.modalOverlay}
        activeOpacity={1}
        onPress={() => setShowAboutModal(false)}
      >
        <View
          style={styles.aboutModalContent}
          onStartShouldSetResponder={() => true}
          onTouchEnd={(e) => e.stopPropagation()}
        >
          <Text style={styles.aboutTitle}>About AeroPulse</Text>
          <ScrollView style={styles.aboutScroll}>
            <Text style={styles.aboutText}>
              AeroPulse provides real-time turbulence forecasting data for aviation professionals and enthusiasts.
            </Text>

            <Text style={styles.aboutSubtitle}>Features:</Text>
            <Text style={styles.aboutText}>
              • Multiple altitude layers from 30,000 to 41,000 feet{'\n'}
              • Real-time turbulence probability visualization{'\n'}
              • Grid and polygon overlay options{'\n'}
              • Time-based forecast selection
            </Text>

            <Text style={styles.aboutSubtitle}>How to Use:</Text>
            <Text style={styles.aboutText}>
              1. Select your desired altitude layer{'\n'}
              2. Toggle between default and terrain Google Maps styles{'\n'}
              3. Use the time selector to view different forecasts{'\n'}
              4. Interpret the color-coded probability scale:
            </Text>
          </ScrollView>

          <TouchableOpacity
            style={styles.closeButton}
            onPress={() => setShowAboutModal(false)}
          >
            <Text style={styles.closeButtonText}>Close</Text>
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    </Modal>
  );

  return (
    <View style={styles.container}>
      <TouchableOpacity
        style={styles.aboutButton}
        onPress={() => setShowAboutModal(true)}
      >
        <Ionicons name="information-circle" size={28} color="white" />
      </TouchableOpacity>

      <AboutModal />

      {/* API Legend Image */}
      <View style={styles.legendContainer}>
        {selectedLayer && (
          <Image
            source={{ 
              uri: `https://realearth.ssec.wisc.edu/api/legend?products=${selectedLayer.gridLayer}`
            }}
            style={styles.legendImage}
            resizeMode="contain"
          />
        )}
      </View>

      {/* Map */}
<MapView
  style={styles.map}
  showsUserLocation={true}
  customMapStyle={selectedMapStyle.style}
  initialRegion={{
    latitude: 37.0902,
    longitude: -95.7129,
    latitudeDelta: 50,
    longitudeDelta: 50,
  }}
  minZoomLevel={2} // Set minimum zoom to prevent invalid tile requests
  maxZoomLevel={12} // Adjust to match RealEarth supported zoom levels
  onPress={handleMapPress} // Allow users to set a custom location by tapping the map
>
  {/* Current Location Marker */}
  {currentLocation && (
    <Marker
      coordinate={currentLocation}
      title="Your Location"
      description="This is your current location."
    >
      <View style={styles.locationDot}>
        <View style={styles.locationDotInner} />
      </View>
    </Marker>
  )}

  {/* Custom Location Marker */}
  {customLocation && (
    <Marker
      coordinate={customLocation}
      title="Custom Location"
      description="This is your selected location."
    />
  )}

  {/* RealEarth Grid Layer */}
  {showGridLayer && selectedTime && selectedLayer && (
    <UrlTile
      key={`${selectedLayer.gridLayer}-${selectedTime}`}
      urlTemplate={`https://realearth.ssec.wisc.edu/api/image?products=${selectedLayer.gridLayer}&time=${selectedTime}&x={x}&y={y}&z={z}`}
      maximumZ={12} // Limit maximum zoom to avoid "size limit exceeded"
      tileSize={256} // Default tile size for RealEarth
      opacity={0.6} // Maintain overlay transparency
      shouldReplaceMapContent={false} // Prevent replacing the base map
    />
  )}
</MapView>

<View style={styles.controls}>
  {currentLocation && (
    <Text style={styles.infoText}>
      Current Location: {currentLocation.latitude.toFixed(6)}, {currentLocation.longitude.toFixed(6)}
    </Text>
  )}
  {customLocation && (
    <Text style={styles.infoText}>
      Custom Location: {customLocation.latitude.toFixed(6)}, {customLocation.longitude.toFixed(6)}
    </Text>
  )}

  <TouchableOpacity
    style={styles.toggleButton}
    onPress={() => {
      setIsLocationEnabled(!isLocationEnabled);
      if (!isLocationEnabled) {
        requestLocationPermission();
      } else {
        setCurrentLocation(null);
      }
    }}
  >
    <Text style={styles.toggleButtonText}>
      {isLocationEnabled ? 'Turn Off Location' : 'Turn On Location'}
    </Text>
  </TouchableOpacity>

  <ScrollView horizontal showsHorizontalScrollIndicator={false}>
    {AVAILABLE_LAYERS.map((layer) => (
      <TouchableOpacity
        key={layer.id}
        style={[
          styles.layerButton,
          selectedLayer.id === layer.id && styles.selectedLayer,
        ]}
        onPress={async () => {
          setSelectedLayer(layer);
          try {
            const url = `https://realearth.ssec.wisc.edu/api/times?products=${layer.gridLayer}`;
            const response = await axios.get(url);
            if (response.data && response.data[layer.gridLayer]) {
              const times = response.data[layer.gridLayer];
              setAvailableTimes(times);
              if (times.length > 0) {
                const latestTime = times[times.length - 1];
                setSelectedTime(latestTime);
              }
            }
          } catch (error) {
            console.error('Error fetching times for new layer:', error);
          }
        }}
      >
        <Text
          style={[
            styles.layerButtonText,
            selectedLayer.id === layer.id && styles.selectedLayerText,
          ]}
        >
          {layer.name}
        </Text>
      </TouchableOpacity>
    ))}
  </ScrollView>

  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.mapStyleRow}>
    {MAP_STYLES.map((style) => (
      <TouchableOpacity
        key={style.id}
        style={[
          styles.layerButton,
          selectedMapStyle.id === style.id && styles.selectedLayer,
        ]}
        onPress={() => setSelectedMapStyle(style)}
      >
        <Text
          style={[
            styles.layerButtonText,
            selectedMapStyle.id === style.id && styles.selectedLayerText,
          ]}
        >
          {style.name}
        </Text>
      </TouchableOpacity>
    ))}
  </ScrollView>

  <TouchableOpacity
    style={styles.timeButton}
    onPress={() => setShowDatePicker(!showDatePicker)}
  >
    <Text style={styles.timeButtonText}>
      {selectedTime ? formatTime(selectedTime) : 'Select Date & Time'}
    </Text>
  </TouchableOpacity>

  <Modal
    visible={showDatePicker}
    transparent={true}
    animationType="slide"
    onRequestClose={() => setShowDatePicker(false)}
  >
    <TouchableOpacity
      style={styles.modalOverlay}
      activeOpacity={1}
      onPress={() => setShowDatePicker(false)}
    >
      <View style={styles.modalContent} onStartShouldSetResponder={() => true}>
        {Object.keys(groupedTimes).length > 0 ? (
          <>
            <View style={styles.datePickerHeader}>
              <Text style={styles.pickerTitle}>Select Date</Text>
            </View>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.dateScroller}
            >
              {Object.keys(groupedTimes)
                .sort((a, b) => parseInt(b) - parseInt(a))
                .map((date) => (
                  <TouchableOpacity
                    key={date}
                    style={[
                      styles.dateOption,
                      selectedDate === date && styles.selectedDateOption,
                    ]}
                    onPress={() => setSelectedDate(date)}
                  >
                    <Text
                      style={[
                        styles.dateOptionText,
                        selectedDate === date && styles.selectedDateOptionText,
                      ]}
                    >
                      {formatDate(date)}
                    </Text>
                  </TouchableOpacity>
                ))}
            </ScrollView>

            {selectedDate && (
              <>
                <View style={styles.timePickerHeader}>
                  <Text style={styles.pickerTitle}>Select Time</Text>
                </View>
                <ScrollView style={styles.timeList}>
                  {groupedTimes[selectedDate].map((time) => (
                    <TouchableOpacity
                      key={time}
                      style={[
                        styles.timeOption,
                        selectedTime === time && styles.selectedTimeOption,
                      ]}
                      onPress={() => {
                        setSelectedTime(time);
                        setShowDatePicker(false);
                      }}
                    >
                      <Text
                        style={[
                          styles.timeOptionText,
                          selectedTime === time && styles.selectedTimeOptionText,
                        ]}
                      >
                        {time.substring(9, 11)}:{time.substring(11, 13)} UTC
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </>
            )}
          </>
        ) : (
          <View style={styles.noTimesContainer}>
          <Text style={styles.noTimesText}>Loading available times...</Text>
        </View>
      )}
            </View>
          </TouchableOpacity>
        </Modal>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    position: 'relative',
  },
  map: {
    width: Dimensions.get('window').width,
    height: Dimensions.get('window').height,
  },
  legendContainer: {
    position: 'absolute',
    top: 10,
    left: Dimensions.get('window').width / 2 - 100,
    width: 200,
    height: 40,
    zIndex: 10,
    backgroundColor: 'white',
    borderRadius: 5,
    padding: 5,
  },
  legendImage: {
    width: '100%',
    height: '100%',
  },
  controls: {
    position: 'absolute',
    bottom: 20,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    padding: 10,
    zIndex: 999,
  },
  layerButton: {
    padding: 10,
    marginHorizontal: 5,
    backgroundColor: '#f0f0f0',
    borderRadius: 5,
  },
  selectedLayer: {
    backgroundColor: '#007AFF',
  },
  layerButtonText: {
    color: '#333',
  },
  selectedLayerText: {
    color: '#fff',
  },
  timeButton: {
    padding: 10,
    marginTop: 10,
    backgroundColor: '#f0f0f0',
    borderRadius: 5,
    alignItems: 'center',
  },
  timeButtonText: {
    color: '#333',
  },
  pickerContainer: {
    position: 'absolute',
    bottom: '100%',
    left: 0,
    right: 0,
    backgroundColor: 'white',
    marginBottom: 10,
    borderRadius: 10,
    padding: 15,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
    zIndex: 1000,
    maxHeight: '50%',
  },
  datePickerHeader: {
    marginBottom: 10,
  },
  timePickerHeader: {
    marginTop: 15,
    marginBottom: 10,
  },
  pickerTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
  },
  dateScroller: {
    flexGrow: 0,
  },
  dateOption: {
    padding: 10,
    marginRight: 10,
    backgroundColor: '#f0f0f0',
    borderRadius: 8,
    minWidth: 100,
    alignItems: 'center',
  },
  selectedDateOption: {
    backgroundColor: '#007AFF',
  },
  dateOptionText: {
    color: '#333',
  },
  selectedDateOptionText: {
    color: 'white',
  },
  timeList: {
    maxHeight: 200,
  },
  timeOption: {
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  selectedTimeOption: {
    backgroundColor: '#e6e6e6',
  },
  timeOptionText: {
    color: '#333',
    fontSize: 15,
  },
  selectedTimeOptionText: {
    color: '#007AFF',
  },
  noTimesContainer: {
    padding: 20,
    alignItems: 'center',
  },
  noTimesText: {
    color: '#666',
    fontSize: 16,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: 'white',
    borderRadius: 10,
    padding: 20,
    width: '90%',
    maxHeight: '80%',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  locationDot: {
    width: 24,
    height: 24,
    backgroundColor: 'rgba(37, 116, 255, 0.2)',
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  locationDotInner: {
    width: 12,
    height: 12,
    backgroundColor: '#2574FF',
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  aboutButton: {
    position: 'absolute',
    top: 10,
    left: 20,
    zIndex: 10,
    padding: 8,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    borderRadius: 20,
  },
  aboutModalContent: {
    backgroundColor: 'white',
    borderRadius: 20,
    padding: 20,
    width: '90%',
    maxHeight: '80%',
    alignSelf: 'center',
  },
  aboutTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 15,
    textAlign: 'center',
    color: '#007AFF',
  },
  aboutSubtitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginTop: 15,
    marginBottom: 10,
    color: '#333',
  },
  aboutText: {
    fontSize: 16,
    lineHeight: 24,
    color: '#444',
    marginBottom: 10,
  },
  aboutScroll: {
    maxHeight: '80%',
  },
  closeButton: {
    marginTop: 20,
    padding: 12,
    backgroundColor: '#007AFF',
    borderRadius: 10,
    alignItems: 'center',
  },
  closeButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  mapStyleRow: {
    marginTop: 10,
  },
  infoText: {
    fontSize: 16,
    color: '#333',
    marginBottom: 5,
  },
  toggleButton: {
    padding: 10,
    backgroundColor: '#007AFF',
    borderRadius: 5,
    marginBottom: 10,
    alignItems: 'center',
  },
  toggleButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
  },
});