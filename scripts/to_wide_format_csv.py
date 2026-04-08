import pandas as pd
import sys


def convert_to_wide_format(input_file, output_file):
    # 1. Load the original CSV (Entity-Attribute-Value format)
    print(f"Loading {input_file}...")
    # The engine='python' and sep=None forces Pandas to sniff out the delimiter automatically
    df = pd.read_csv(input_file, sep=None, engine="python", quoting=3)

    # 2. Prefix the parameter names with 'param_' for easy namespace tracking
    df["wide_param_name"] = "param_" + df["param_name"]

    # 3. Pivot the table.
    # The 'index', 'label', 'method', 'dim1', and 'dim2' identify a single, unique row.
    # We turn the values of 'wide_param_name' into columns, filled by 'param_value'.
    print("Pivoting data to Wide Format...")
    df_wide = df.pivot(
        index=["index", "label", "method", "dim1", "dim2"],
        columns="wide_param_name",
        values="param_value",
    ).reset_index()

    # Clean up the hidden Pandas column indexing name
    df_wide.columns.name = None

    # 4. Reorder the columns so it's clean and predictable:
    # [Metadata] -> [Parameters] -> [Dimensions]
    param_cols = [col for col in df_wide.columns if col.startswith("param_")]
    base_cols = ["index", "label", "method"]
    dim_cols = ["dim1", "dim2"]

    final_columns = base_cols + param_cols + dim_cols
    df_wide = df_wide[final_columns]

    # 5. Save the result
    print(f"Saving wide format to {output_file}...")
    # index=False prevents pandas from writing row numbers to the CSV
    df_wide.to_csv(output_file, index=False)

    print("Done! Original Shape:", df.shape, "-> Wide Shape:", df_wide.shape)


# Run the function
if __name__ == "__main__":
    convert_to_wide_format(sys.argv[1], sys.argv[2])
