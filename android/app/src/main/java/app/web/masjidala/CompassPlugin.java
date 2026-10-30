package app.web.masjidala;

import android.content.Context;
import android.hardware.GeomagneticField;
import android.hardware.Sensor;
import android.hardware.SensorEvent;
import android.hardware.SensorEventListener;
import android.hardware.SensorManager;
import android.view.Surface;
import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/** Publishes orientation and its quality from the same north-referenced sensor event. */
@CapacitorPlugin(name = "Compass")
public class CompassPlugin extends Plugin implements SensorEventListener {
    private SensorManager manager;
    private boolean running;

    @PluginMethod
    public void start(PluginCall call) {
        getActivity().runOnUiThread(() -> {
            stopListening();
            manager = (SensorManager) getContext().getSystemService(Context.SENSOR_SERVICE);
            Sensor sensor = manager == null ? null : manager.getDefaultSensor(Sensor.TYPE_ROTATION_VECTOR);
            if (sensor == null || !manager.registerListener(this, sensor, SensorManager.SENSOR_DELAY_GAME)) {
                call.reject("Peranti ini tidak menyokong kompas.");
                return;
            }
            running = true;
            call.resolve();
        });
    }

    @PluginMethod
    public void stop(PluginCall call) {
        getActivity().runOnUiThread(() -> {
            stopListening();
            call.resolve();
        });
    }

    @PluginMethod
    public void getDeclination(PluginCall call) {
        Double latitude = call.getDouble("latitude");
        Double longitude = call.getDouble("longitude");
        if (latitude == null || longitude == null || !Double.isFinite(latitude) || !Double.isFinite(longitude)
            || Math.abs(latitude) > 90 || Math.abs(longitude) > 180) {
            call.reject("Koordinat lokasi tidak sah.");
            return;
        }
        GeomagneticField field = new GeomagneticField(latitude.floatValue(), longitude.floatValue(), 0, System.currentTimeMillis());
        call.resolve(new JSObject().put("degrees", field.getDeclination()));
    }

    @Override
    public void onSensorChanged(SensorEvent event) {
        if (!running) return;
        float[] quaternion = new float[4];
        SensorManager.getQuaternionFromVector(quaternion, event.values);
        float[] matrix = new float[9];
        float[] screenMatrix = new float[9];
        SensorManager.getRotationMatrixFromVector(matrix, event.values);
        int x = SensorManager.AXIS_X;
        int y = SensorManager.AXIS_Y;
        int rotation = getActivity().getWindowManager().getDefaultDisplay().getRotation();
        if (rotation == Surface.ROTATION_90) {
            x = SensorManager.AXIS_Y;
            y = SensorManager.AXIS_MINUS_X;
        } else if (rotation == Surface.ROTATION_180) {
            x = SensorManager.AXIS_MINUS_X;
            y = SensorManager.AXIS_MINUS_Y;
        } else if (rotation == Surface.ROTATION_270) {
            x = SensorManager.AXIS_MINUS_Y;
            y = SensorManager.AXIS_X;
        }
        SensorManager.remapCoordinateSystem(matrix, x, y, screenMatrix);
        // Screen top projected onto East/North; reject a nearly vertical top edge.
        double east = screenMatrix[1];
        double north = screenMatrix[4];
        JSObject reading = new JSObject();
        reading.put("quaternion", JSArray.from(new double[] { quaternion[1], quaternion[2], quaternion[3], quaternion[0] }));
        reading.put("heading", Math.hypot(east, north) < 0.1 ? JSObject.NULL
            : (Math.toDegrees(Math.atan2(east, north)) + 360) % 360);
        reading.put("accuracy", event.accuracy);
        double error = event.values.length >= 5 ? event.values[4] : -1;
        reading.put("headingAccuracy", error >= 0 && Double.isFinite(error) ? Math.toDegrees(error) : JSObject.NULL);
        notifyListeners("reading", reading);
    }

    @Override
    public void onAccuracyChanged(Sensor sensor, int accuracy) {
        // Quality is delivered with its corresponding orientation in onSensorChanged.
    }

    private void stopListening() {
        running = false;
        if (manager != null) manager.unregisterListener(this);
    }

    @Override
    protected void handleOnPause() { stopListening(); }

    @Override
    protected void handleOnDestroy() { stopListening(); }
}
