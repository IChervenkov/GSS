import sys
import time
from smartcard.System import readers
from smartcard.util import toHexString
import pyautogui  # For simulating keyboard input
import keyboard  # For detecting keypress

# Ensure pyautogui and keyboard are installed
# pip install pyautogui keyboard

def read_card_uid():
    try:
        # Get list of available readers
        available_readers = readers()
        if not available_readers:
            print("No NFC readers found.")
            return None

        # Use the first reader
        reader = available_readers[0]
        print(f"Using reader: {reader}")

        # Connect to the card
        connection = reader.createConnection()
        connection.connect()

        # Send APDU command to get UID (specific to ACR122U)
        GET_UID_APDU = [0xFF, 0xCA, 0x00, 0x00, 0x00]
        data, sw1, sw2 = connection.transmit(GET_UID_APDU)

        if sw1 == 0x90 and sw2 == 0x00:  # Success status word
            uid = toHexString(data).replace(" ", "")
            return uid
        else:
            print(f"Failed to read UID. SW1: {sw1}, SW2: {sw2}")
            return None

    except Exception as e:
        print(f"Error: {e}")
        return None

def main():
    print("Place your NFC card near the reader...")
    print("Press Ctrl + Shift + Alt + S to stop scanning.")
    stop_scanning = False

    # Detect Ctrl + Shift + Alt + S to stop the loop
    def stop_scan():
        nonlocal stop_scanning
        stop_scanning = True

    keyboard.add_hotkey('ctrl+shift+alt+s', stop_scan)

    while not stop_scanning:
        uid = read_card_uid()
        if uid:
            print(f"Card UID: {uid}") 
            # Simulate typing the UID at the current cursor position
            pyautogui.typewrite(uid)
            # Removed pyautogui.press('enter') to avoid new line
        time.sleep(1)  # Poll every second

    print("Scanning stopped.")

if __name__ == "__main__":
    main()
