import { View } from 'react-native';
import MapView, { Marker } from 'react-native-maps';
import React from 'react';

export default function LiveMap() {
  const shopCoords = {
    latitude: 5.5949221,
    longitude: -0.2709809,
  };

  return (
    <View style={{ width: '100%', height: 200 }}>
      <MapView
        style={{ flex: 1 }}
        initialRegion={{
          ...shopCoords,
          latitudeDelta: 0.005,
          longitudeDelta: 0.005,
        }}
      >
        <Marker
          coordinate={shopCoords}
          title="The Medicine Barber Shop Ltd"
          description="Underwood St, Kwashieman, Ghana"
        />
      </MapView>
    </View>
  );
}
