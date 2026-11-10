export const sample = `{
  "project": "Illustrative gateway data",
  "signals": {
    "VehicleSpeed": { "type": "uint16", "unit": "km/h", "cycle_ms": 10, "initial": 0, "mapping": { "port": "VehicleSpeedIn", "element": "value" } },
    "EngineSpeed": { "type": "uint16", "unit": "rpm", "cycle_ms": 10, "initial": 0, "mapping": { "port": "EngineSpeedIn", "element": "value" } },
    "CoolantTemp": { "type": "sint16", "unit": "°C", "cycle_ms": 100, "initial": -40, "mapping": { "port": "CoolantTempIn", "element": "value" } },
    "BatteryVoltage": { "type": "uint16", "unit": "mV", "cycle_ms": 100, "initial": 12000 },
    "IgnitionState": { "type": "uint8", "unit": null, "cycle_ms": 20, "initial": 0 },
    "BrakeSwitch": { "type": "boolean", "cycle_ms": 10, "initial": false }
  },
  "interfaces": [
    { "name": "Sensor supply", "pin": "P02.1", "direction": "output", "voltage": 3.3, "enabled": true },
    { "name": "Temperature input", "pin": "P03.4", "direction": "input", "voltage": 3.3, "enabled": true },
    { "name": "Spare input", "pin": "P05.0", "direction": "input", "voltage": null, "enabled": false }
  ],
  "precision_examples": { "large_id": 9007199254740993, "large_exponent": 1e400, "negative_zero": -0, "decimal": 0.123456789012345678901 },
  "configuration": { "enabled": true, "description": "", "fallback": null, "channels": ["primary", "secondary"] }
}
`;
