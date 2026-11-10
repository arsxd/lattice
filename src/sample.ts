// Synthetic data for exploring the editor. No production or standards-conformance claim.
export const sample = `{
  "signals": {
    "VehicleSpeed": { "name": "Vehicle speed", "unit": "km/h", "cycle_ms": 10, "enabled": true, "default": 0, "limits": [0, 250], "interface": { "port": "SpeedIn", "element": "value" } },
    "EngineSpeed": { "name": "Engine speed", "unit": "rpm", "cycle_ms": 10, "enabled": true, "default": 0, "limits": [0, 8000], "interface": { "port": "EngineIn", "element": "rpm" } },
    "CoolantTemp": { "name": "Coolant temperature", "unit": "°C", "cycle_ms": 100, "enabled": true, "default": -40, "limits": [-40, 150], "interface": { "port": "CoolantIn", "element": "temperature" } },
    "BatteryVoltage": { "name": "Battery voltage", "unit": "V", "cycle_ms": 100, "enabled": true, "default": 12.5, "limits": [9, 16], "interface": { "port": "BatteryIn", "element": "voltage" } },
    "BrakePressed": { "name": "Brake pressed", "unit": null, "cycle_ms": 10, "enabled": true, "default": false, "limits": [], "interface": { "port": "BrakeIn", "element": "pressed" } },
    "CabinTemp": { "name": "Cabin temperature", "unit": "°C", "cycle_ms": 500, "enabled": true, "default": 22, "limits": [-20, 60], "interface": { "port": "CabinIn", "element": "temperature" } },
    "AmbientLight": { "name": "Ambient light", "unit": "lux", "cycle_ms": 200, "enabled": false, "default": null, "limits": [0, 100000], "interface": { "port": "LightIn", "element": "intensity" } },
    "DoorStatus": { "name": "Door status", "unit": null, "cycle_ms": 20, "enabled": true, "default": "closed", "limits": ["open", "closed", "unknown"], "interface": { "port": "DoorIn", "element": "status" } }
  },
  "interfaces": [
    { "pin": "P02.1", "name": "Sensor supply", "direction": "output", "voltage": 5, "enabled": true, "tags": ["power", "sensor"] },
    { "pin": "P03.4", "name": "Temperature input", "direction": "input", "voltage": 3.3, "enabled": true, "tags": ["analog"] },
    { "pin": "P05.0", "name": "Brake switch", "direction": "input", "voltage": 12, "enabled": true, "tags": ["digital", "safety"] },
    { "pin": "P07.2", "name": "Spare channel", "direction": "input", "voltage": null, "enabled": false, "tags": [] }
  ],
  "precision": { "large_id": 9007199254740993, "large_exponent": 1e400, "negative_zero": -0, "decimal": 0.123456789012345678901, "leading_zero_text": "00127" },
  "nested_groups": { "Feature_params": [{ "name": "Speed warning", "threshold": 120, "enabled": true }, { "name": "Low voltage", "threshold": 10.5, "enabled": false }], "phy_params": [{ "name": "ADC resolution", "value": 12, "unit": "bit" }] },
  "about": { "dataset": "Lattice sample workspace", "synthetic": true, "description": "Explore tables, sorting, value filters, blank cells, simple arrays, nested objects and exact numeric tokens. This is not a production AUTOSAR configuration." }
}
`;
