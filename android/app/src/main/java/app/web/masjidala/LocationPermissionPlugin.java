package app.web.masjidala;

import android.Manifest;
import android.content.pm.PackageManager;
import androidx.core.content.ContextCompat;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/** Reads the OS grant without showing a permission dialog or accessing location. */
@CapacitorPlugin(name = "LocationPermission")
public class LocationPermissionPlugin extends Plugin {
    @PluginMethod
    public void getPermissionState(PluginCall call) {
        boolean granted = ContextCompat.checkSelfPermission(getContext(), Manifest.permission.ACCESS_COARSE_LOCATION)
            == PackageManager.PERMISSION_GRANTED
            || ContextCompat.checkSelfPermission(getContext(), Manifest.permission.ACCESS_FINE_LOCATION)
            == PackageManager.PERMISSION_GRANTED;
        // WebView geolocation owns the actual request; approximate location is sufficient.
        call.resolve(new JSObject().put("state", granted ? "granted" : "prompt"));
    }
}
