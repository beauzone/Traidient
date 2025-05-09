import sys
print('Python path:')
print(sys.path)
print('\nTrying to import pandas_ta:')
try:
    import pandas_ta
    print('pandas_ta successfully imported, version:', pandas_ta.__version__)
except ImportError as e:
    print('Import failed:', e)