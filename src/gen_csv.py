import csv
import random

def generate_random_points(filename, num_rows=100, min_val=0, max_val=100):
    """
    Generates a CSV file with random integer points (x, y).
    """
    header = ['x', 'y']
    
    try:
        with open(filename, mode='w', newline='') as file:
            writer = csv.writer(file)
            writer.writerow(header) # Write the column names
            
            for _ in range(num_rows):
                # Generate two random integers for x and y
                x = random.randint(min_val, max_val)
                y = random.randint(min_val, max_val)
                writer.writerow([x, y])
                
        print(f"Successfully created '{filename}' with {num_rows} rows.")
        
    except IOError as e:
        print(f"An error occurred while writing the file: {e}")

if __name__ == "__main__":
    generate_random_points('points.csv', 100, 0, 10)