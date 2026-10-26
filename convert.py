import cv2
import subprocess
import os


def convert_folder_to_svg(folder_path):
    # Check if folder exists
    if not os.path.exists(folder_path):
        print(f"❌ Error: Folder '{folder_path}' does not exist.")
        return

    print(f"📂 Scanning folder: {folder_path}...")

    # Find all image files in the folder
    valid_extensions = ('.jpg', '.jpeg', '.png')
    images = [f for f in os.listdir(folder_path) if f.lower().endswith(valid_extensions)]

    if not images:
        print("⚠️ No JPG or PNG images found in this folder.")
        return

    for image_file in images:
        input_path = os.path.join(folder_path, image_file)

        # Get the filename without the extension (e.g., "cat")
        base_name = os.path.splitext(image_file)[0]
        output_path = os.path.join(folder_path, f"{base_name}.svg")
        temp_pbm = "temp.pbm"

        print(f"🔄 Converting '{image_file}'...")

        try:
            # 1. Read in grayscale
            img = cv2.imread(input_path, cv2.IMREAD_GRAYSCALE)
            if img is None:
                print(f"  ❌ Could not read {image_file}")
                continue

            # 2. Otsu's thresholding
            _, thresh = cv2.threshold(img, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)

            # 3. Save temp PBM
            cv2.imwrite(temp_pbm, thresh)

            # 4. Run Potrace
            # Note: If potrace is not in your PATH, change "potrace" to the full path (e.g., r"C:\potrace\potrace.exe")
            subprocess.run(
                ["potrace", temp_pbm, "-s", "-o", output_path, "--turdsize", "2"],
                check=True
            )
            print(f"  ✅ Saved: {base_name}.svg")

        except FileNotFoundError:
            print("  ❌ Error: Potrace is not installed or not in your system PATH.")
            print("  👉 Download it from http://potrace.sourceforge.net/ and add it to PATH.")
            break  # Stop the loop if potrace is missing
        except Exception as e:
            print(f"  ❌ Error processing {image_file}: {e}")
        finally:
            # Clean up the temp file
            if os.path.exists(temp_pbm):
                os.remove(temp_pbm)

    print("🎉 Batch conversion complete!")


if __name__ == "__main__":
    # ==========================================
    # CHANGE THIS PATH TO YOUR TARGET FOLDER
    # ==========================================
    target_folder = "public/assets/others"

    convert_folder_to_svg(target_folder)