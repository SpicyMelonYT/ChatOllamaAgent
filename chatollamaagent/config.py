import json
import os
from pathlib import Path

# Get the directory containing this file
CONFIG_DIR = Path(__file__).parent
CONFIG_FILE = CONFIG_DIR / 'config.json'

def ensure_config_file():
    """Create config file if it doesn't exist"""
    if not CONFIG_FILE.exists():
        with open(CONFIG_FILE, 'w') as f:
            json.dump({}, f, indent=4)

def get_config():
    """Get the current configuration"""
    ensure_config_file()
    with open(CONFIG_FILE, 'r') as f:
        return json.load(f)

def set_config(key, value):
    """Set a configuration value"""
    ensure_config_file()
    config = get_config()
    config[key] = value
    with open(CONFIG_FILE, 'w') as f:
        json.dump(config, f, indent=4)

def get_config_value(key, default=None):
    """
    Get a configuration value, setting and returning the default if not found.
    
    Args:
        key: The configuration key to look up
        default: The default value to use if the key is not found
    
    Returns:
        The configuration value or the default value
    """
    config = get_config()
    if key not in config and default is not None:
        # If key doesn't exist and we have a default, set it
        set_config(key, default)
        return default
    return config.get(key, default) 