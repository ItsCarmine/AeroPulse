import React, { useState, useEffect } from 'react';
import { StyleSheet, View, Dimensions, TouchableOpacity, Text, ScrollView, Modal } from 'react-native';
import MapView, { Marker, Overlay, Polygon, UrlTile } from 'react-native-maps';
import axios from 'axios';
import DateTimePicker from '@react-native-community/datetimepicker';
import { format, parseISO } from 'date-fns';
import Geolocation from 'react-native-geolocation-service';
import { PermissionsAndroid, Platform } from 'react-native';
import * as Location from 'expo-location';

interface TurbulenceFeature {
  type: 'Feature';
  properties: {
    PROBABILITY: number;
    ID: string;
    TS_INGESTED: number;
    RE_TOOLTIP: string;
    RE_PRODUCT_ID: string;
    RE_PRODUCT_NAME: string;
    RE_ID: string;
  };
  geometry: {
    type: 'Polygon';
    coordinates: [number, number][][];
  };
}

interface TurbulenceData {
  type: 'FeatureCollection';
  features: TurbulenceFeature[];
}

interface LayerConfig {
  id: string;
  name: string;
  gridLayer: string;
  polyLayer: string;
}

const AVAILABLE_LAYERS: LayerConfig[] = [
  { id: '30-31', name: '30-31 kft', gridLayer: 'turb-grid-30-31-kft', polyLayer: 'turb-poly-30-31-kft' },
  { id: '32-33', name: '32-33 kft', gridLayer: 'turb-grid-32-33-kft', polyLayer: 'turb-poly-32-33-kft' },
  { id: '34-35', name: '34-35 kft', gridLayer: 'turb-grid-34-35-kft', polyLayer: 'turb-poly-34-35-kft' },
  { id: '36-37', name: '36-37 kft', gridLayer: 'turb-grid-36-37-kft', polyLayer: 'turb-poly-36-37-kft' },
  { id: '38-39', name: '38-39 kft', gridLayer: 'turb-grid-38-39-kft', polyLayer: 'turb-poly-38-39-kft' },
  { id: '40-41', name: '40-41 kft', gridLayer: 'turb-grid-40-41-kft', polyLayer: 'turb-poly-40-41-kft' },
  { id: 'max', name: 'Max Value', gridLayer: 'turb-grid-Max-Value-30-41-kft', polyLayer: 'turb-poly-Max-Value-30-41-kft' },
];

export default function Home() {
  const [turbulenceData, setTurbulenceData] = useState<TurbulenceData | null>(null);
  const [selectedLayer, setSelectedLayer] = useState<LayerConfig>(AVAILABLE_LAYERS[0]);
  const [availableTimes, setAvailableTimes] = useState<string[]>([]);
  const [selectedTime, setSelectedTime] = useState<string>('');
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showGridLayer, setShowGridLayer] = useState(true);
  const [showPolygons, setShowPolygons] = useState(true);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [groupedTimes, setGroupedTimes] = useState<{ [key: string]: string[] }>({});
  const [currentLocation, setCurrentLocation] = useState<{ latitude: number; longitude: number } | null>(null);

  useEffect(() => {
    console.log('Selected layer changed:', selectedLayer);
    fetchTimes();
  }, [selectedLayer]);

  useEffect(() => {
    if (availableTimes.length > 0) {
      // console.log('Grouping times:', availableTimes);
      const grouped = availableTimes.reduce((acc, time) => {
        const date = time.substring(0, 8); // Get YYYYMMDD
        if (!acc[date]) {
          acc[date] = [];
        }
        acc[date].push(time);
        return acc;
      }, {} as { [key: string]: string[] });
      // console.log('Grouped times:', grouped);
      setGroupedTimes(grouped);
      setSelectedDate(Object.keys(grouped)[0]);
    }
  }, [availableTimes]);

  useEffect(() => {
    requestLocationPermission();
  }, []);
  
  const requestLocationPermission = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === 'granted') {
        Location.watchPositionAsync(
          {
            accuracy: Location.Accuracy.High,
            timeInterval: 1000,
            distanceInterval: 1
          },
          (location) => {
            setCurrentLocation({
              latitude: location.coords.latitude,
              longitude: location.coords.longitude
            });
          }
        );
      }
    } catch (err) {
      console.warn('Location permission error:', err);
    }
  };
  
  const watchLocation = () => {
    Geolocation.watchPosition(
      (position) => {
        setCurrentLocation({
          latitude: Number(position.coords.latitude),
          longitude: Number(position.coords.longitude)
        });
      },
      (error) => {
        console.error('Location error:', error);
      },
      {
        enableHighAccuracy: true,
        distanceFilter: 10,
        interval: 5000,
        fastestInterval: 2000,
      }
    );
  };

  const fetchTimes = async () => {
    try {
      const productId = selectedLayer.gridLayer;
      // console.log('Fetching times for product:', productId);
      
      const url = `https://realearth.ssec.wisc.edu/api/times?products=${productId}`;
      const response = await axios.get(url);
      
      let times: string[] = [];
      if (response.data && response.data[productId]) {
        times = response.data[productId];
        // console.log('Found times for layer:', times.length);
        
        setAvailableTimes(times);
        if (times.length > 0) {
          const latestTime = times[times.length - 1];
          // console.log('Setting latest time:', latestTime);
          setSelectedTime(latestTime);
          fetchTurbulenceData(latestTime);
        }
      }
    } catch (error) {
      console.error('Error fetching times:', error);
    }
  };

  useEffect(() => {
    // console.log('Current location updated:', currentLocation);
  }, [currentLocation]);

  useEffect(() => {
    // console.log('Available times updated:', availableTimes);
    if (availableTimes.length > 0) {
      // console.log('First available time:', availableTimes[0]);
    }
  }, [availableTimes]);

  const fetchTurbulenceData = async (time: string) => {
    try {
      // console.log('Fetching turbulence data for:', selectedLayer.polyLayer, time);
      const response = await axios.get(
        `https://realearth.ssec.wisc.edu/api/geojson?products=${selectedLayer.polyLayer}&time=${time}`
      );
      // console.log('Turbulence data received:', response.data);
      setTurbulenceData(response.data);
    } catch (error) {
      console.error('Error fetching turbulence data:', error);
    }
  };

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

  const getPolygonColor = (probability: number) => {
    // Color scale based on probability
    if (probability >= 0.8) return 'rgba(255, 0, 0, 0.5)';
    if (probability >= 0.6) return 'rgba(255, 165, 0, 0.5)';
    if (probability >= 0.4) return 'rgba(255, 255, 0, 0.5)';
    return 'rgba(0, 255, 0, 0.5)';
  };

  // Add this useEffect to reset states when layer changes
  useEffect(() => {
    setShowDatePicker(false); // Close the picker when changing layers
    setAvailableTimes([]); // Clear available times
    setGroupedTimes({}); // Clear grouped times
    setSelectedDate(null); // Clear selected date
    fetchTimes(); // Fetch new times for the selected layer
  }, [selectedLayer]);

  // Add this useEffect to monitor state changes
  useEffect(() => {
    // console.log('State update:', {
    //   selectedLayer: selectedLayer.id,
    //   selectedTime,
    //   availableTimesCount: availableTimes.length,
    //   hasGroupedTimes: Object.keys(groupedTimes).length > 0,
    //   hasTurbulenceData: turbulenceData !== null
    // });
  }, [selectedLayer, selectedTime, availableTimes, groupedTimes, turbulenceData]);

  return (
    <View style={styles.container}>
      <MapView
        style={styles.map}
        showsUserLocation={true}
        initialRegion={{
          latitude: 37.0902,
          longitude: -95.7129,
          latitudeDelta: 50,
          longitudeDelta: 50,
        }}
      >
        {showGridLayer && selectedTime && selectedLayer && (
          <UrlTile
            key={`${selectedLayer.gridLayer}-${selectedTime}`}
            urlTemplate={`https://realearth.ssec.wisc.edu/api/image?products=${selectedLayer.gridLayer}&time=${selectedTime}&x={x}&y={y}&z={z}`}
            maximumZ={20}
            opacity={0.6}
          />
        )}
        
        {showPolygons && turbulenceData?.features?.map((feature, index) => (
          <Polygon
            key={index}
            coordinates={feature.geometry.coordinates[0].map(coord => ({
              latitude: coord[1],
              longitude: coord[0]
            }))}
            fillColor={getPolygonColor(feature.properties.PROBABILITY)}
            strokeColor="black"
            strokeWidth={1}
          />
        ))}
        {/* {currentLocation && (
        <Marker
          coordinate={{
            latitude: Number(currentLocation.latitude),
            longitude: Number(currentLocation.longitude)
          }}
          anchor={{ x: 0.5, y: 0.5 }}
        >
          <View style={styles.locationDot}>
            <View style={styles.locationDotInner} />
          </View>
        </Marker>
      )} */}
      </MapView>

      <View style={styles.controls}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          {AVAILABLE_LAYERS.map((layer) => (
            <TouchableOpacity
              key={layer.id}
              style={[
                styles.layerButton,
                selectedLayer.id === layer.id && styles.selectedLayer
              ]}
              onPress={async () => {  // Make this async
                // console.log('Switching to layer:', layer);
                // Clear states first
                setTurbulenceData(null);
                setSelectedTime('');
                setAvailableTimes([]);
                setGroupedTimes({});
                setSelectedDate(null);
                
                // Then set new layer
                setSelectedLayer(layer);
                
                // Directly fetch times for the new layer
                try {
                  const url = `https://realearth.ssec.wisc.edu/api/times?products=${layer.gridLayer}`;
                  const response = await axios.get(url);
                  
                  if (response.data && response.data[layer.gridLayer]) {
                    const times = response.data[layer.gridLayer];
                    // console.log('New layer times:', times);
                    setAvailableTimes(times);
                    
                    if (times.length > 0) {
                      const latestTime = times[times.length - 1];
                      setSelectedTime(latestTime);
                      fetchTurbulenceData(latestTime);
                    }
                  }
                } catch (error) {
                  console.error('Error fetching times for new layer:', error);
                }
              }}
            >
              <Text style={[
                styles.layerButtonText,
                selectedLayer.id === layer.id && styles.selectedLayerText
              ]}>
                {layer.name}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        <View style={styles.toggleContainer}>
          <TouchableOpacity
            style={[styles.toggleButton, showGridLayer && styles.activeToggle]}
            onPress={() => setShowGridLayer(!showGridLayer)}
          >
            <Text style={styles.toggleText}>Grid</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.toggleButton, showPolygons && styles.activeToggle]}
            onPress={() => setShowPolygons(!showPolygons)}
          >
            <Text style={styles.toggleText}>Polygons</Text>
          </TouchableOpacity>
        </View>

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
            <View 
              style={styles.modalContent}
              onStartShouldSetResponder={() => true}
            >
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
                    {Object.keys(groupedTimes).map(date => (
                      <TouchableOpacity
                        key={date}
                        style={[
                          styles.dateOption,
                          selectedDate === date && styles.selectedDateOption
                        ]}
                        onPress={() => setSelectedDate(date)}
                      >
                        <Text style={[
                          styles.dateOptionText,
                          selectedDate === date && styles.selectedDateOptionText
                        ]}>
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
                              selectedTime === time && styles.selectedTimeOption
                            ]}
                            onPress={() => {
                              setSelectedTime(time);
                              fetchTurbulenceData(time);
                              setShowDatePicker(false);
                            }}
                          >
                            <Text style={[
                              styles.timeOptionText,
                              selectedTime === time && styles.selectedTimeOptionText
                            ]}>
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
  },
  map: {
    width: Dimensions.get('window').width,
    height: Dimensions.get('window').height,
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
  toggleContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 10,
  },
  toggleButton: {
    padding: 10,
    marginHorizontal: 5,
    backgroundColor: '#f0f0f0',
    borderRadius: 5,
  },
  activeToggle: {
    backgroundColor: '#007AFF',
  },
  toggleText: {
    color: '#333',
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
});