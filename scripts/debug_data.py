#!/usr/bin/env python3
"""
Debug script to examine the Excel data structure
"""

import pandas as pd
import json

def debug_excel_data():
    excel_path = "Data/600-player-data-scraped.xlsx"
    df = pd.read_excel(excel_path)
    
    print(f"Excel file shape: {df.shape}")
    print(f"Columns: {list(df.columns)}")
    print("\nFirst few rows:")
    print(df.head())
    
    print("\nChecking for NaN values:")
    print(df.isnull().sum())
    
    print("\nSample row data:")
    for idx, row in df.head(3).iterrows():
        print(f"\nRow {idx}:")
        print(f"  Primary: {row.get('primary', 'N/A')}")
        print(f"  Secondary: {row.get('secondary', 'N/A')}")
        
        # Check position columns
        position_cols = ['LB', 'CB', 'RB', 'LWB', 'RWB', 'CDM', 'CM', 'CAM', 'LM', 'RM', 'CF', 'ST', 'LW', 'RW', 'GK']
        for pos in position_cols:
            value = row.get(pos, 'N/A')
            if pd.notna(value) and value != 0:
                print(f"  {pos}: {value}")
        
        # Try to parse inputData
        try:
            input_data = json.loads(row['inputData'])
            metadata = input_data['player']['metadata']
            print(f"  Attributes: PAC={metadata.get('pace')}, SHO={metadata.get('shooting')}, PAS={metadata.get('passing')}, DRI={metadata.get('dribbling')}, DEF={metadata.get('defense')}, PHY={metadata.get('physical')}")
        except Exception as e:
            print(f"  Error parsing inputData: {e}")

if __name__ == "__main__":
    debug_excel_data()
