import os
import sys
import json
import subprocess

sys.stdout.reconfigure(encoding='utf-8')

DOWNLOADS_DIR = os.path.join(os.path.expanduser("~"), "Downloads")
CDN_BASE = "https://prod-images-static.radiopaedia.org/images/"

COOKIE = "_sharedID=1472dc4a-eb26-4869-a0c3-cf0f17f0624b; panoramaId_expiry=1777620085757; _cc_id=5f4d750ddaa180f17d74713d27cb8c46; panoramaId=5b453ee0e2831bfcd1cb9cb32fb9185ca02c0769bd8651452654e707496e7954; _curator_id=DE.V1.22418422811c.1776521024792; cf_clearance=v_9EUf3WDLXLwnPHlftuYplSlQDFSZY.iBviV4sMziY-1777460848-1.2.1.1-7RwWKyCYVeVEwxOK6NQO7wCy0GW1dcToI5FY6F6nO._dg1YmUtQ04kozE_yP7HBBPyenEUp79hJZV6UsnxbUt7TrSugiQnGtn.khh_bTcStjaxRA_HsvP6igzolce97HnAnPAf1pwd7MYOD.jXa_0JPmb_H53bxWmEvcTlpOSqGkxSvRYrIoMnCbMZ7oytzWHJwchtCvb8U4Ifdyuwb7f8O4I.8g_Cs4T8xZTLQnzUZAAK_8EJFn7W5pErkQ3JDIwQlpF2I8Antb8r3B3ckvdkEAHFTTTGqaQc1_5DHfwrxBh2vKYXI80jAGpTgY6o_8tdyuw82wjLGoVb9_A4iDLA; remember_user_token=eyJfcmFpbHMiOnsibWVzc2FnZSI6IlcxczFNRGMzTmpGZExDSjZkbkpWTkhsWFFuVnJjbE5aV0RGT2FVdFJOeUlzSWpFM056YzBOVGcxT1RndU5qQXlNakkwT0NKZCIsImV4cCI6IjIwMjYtMDUtMTNUMTA6Mjk6NTguNjAyWiIsInB1ciI6ImNvb2tpZS5yZW1lbWJlcl91c2VyX3Rva2VuIn19--ba72e45a5ce8dd8c0d8f06bd35ed4fa753335000; __Host-Http_session=0PJmNnoBc2KQhhOZ4XxRMkSX7nj0IVRn3jBzbL2X%2FJUM0H9c398rWmiOQn24Me21H8QCHbqyfqGs%2FT4NscujR9J%2FVEmua5kWfMCaj2Hv9v9x06NdxvkqHSy2AQe3xkIZ4G0pVMMmzUmt3399D7k8M7fNxPks6cxinEd5guQNwkrsmKoctTmOHYDaMpri9O5Ydo9%2FtTNgbI%2Fy0TkJVfzaHBI855k1TjcUL%2FdTmy2K4V%2BPLCVHz0OSFAk259rHHmg3wlWU5rFjVn0XWEe%2BeBywcO%2B4vpzuoezKLvu67%2F%2F6K4JwuoVLmNwxZ%2BnUiZ3OxT0Ai6BcZJERMUtdlLVyeWnYCCgS%2FoVDj9OVeD0YLg76QYr4J720BqT%2FLjC%2B%2FaW2NuSQbTX%2Fnc7RRgWRk6NVOKplkQmcf49wSBb83UNelDsarXvrM2ANDB5SdnzpCkLIu63TwFs8pckRgtOcpDSnB%2BPPoiGUuW8oz9LPkUWyiK6Q2BTJ%2Fo7p5mx26D1Yug%3D%3D--wUvCNhWRE2mZIWl4--66%2BRvvozZu9SLTR%2Bp6N9iQ%3D%3D"

def curl_get(url, output_path=None):
    cmd = [
        "curl", "-s", "-L",
        "-H", f"Cookie: {COOKIE}",
        "-H", "Referer: https://radiopaedia.org/",
        "-H", "User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Safari/537.36 Edg/147.0.0.0",
        "-w", "%{http_code}",
        "-o", output_path if output_path else "NUL",
        url
    ]
    result = subprocess.run(cmd, capture_output=True, timeout=20)
    http_code = int(result.stdout[-3:]) if result.stdout else 0
    return http_code

def download_radiopaedia_stack(json_file):
    with open(json_file, 'r', encoding='utf-8') as f:
        data = json.load(f)

    study = data.get('study', data)
    series_list = study.get('series', [])
    if not series_list:
        print("Khong tim thay series")
        return

    print(f"So series  : {len(series_list)}")
    for i, s in enumerate(series_list):
        print(f"  Series {i}: ID={s.get('series_id')} | {len(s.get('frames', []))} lat cat")

    folder_name = input("\nNhap ten thu muc luu anh (se tao trong Downloads): ").strip()
    if not folder_name:
        folder_name = "radiopaedia_download"

    total_success = 0
    total_all = 0

    for si, series in enumerate(series_list):
        series_id = series.get('series_id', f'series_{si}')
        frames = series.get('frames', [])
        thumbnailed_files = series.get('encodings', {}).get('thumbnailed_files', [])

        if not frames or not thumbnailed_files:
            print(f"\n[Series {si}] Khong co du lieu, bo qua.")
            continue

        output_dir = os.path.join(DOWNLOADS_DIR, folder_name, f"series_{si}_{series_id}")
        os.makedirs(output_dir, exist_ok=True)

        total = min(len(frames), len(thumbnailed_files))
        total_all += total
        success_count = 0

        print(f"\n--- Series {si} (ID={series_id}) | {total} lat cat ---")
        print(f"Luu vao: {output_dir}\n")

        for index in range(total):
            frame_id = frames[index].get('id')
            original = thumbnailed_files[index].get('original', '')
            if not frame_id or not original:
                continue

            url = f"{CDN_BASE}{frame_id}/{original}"
            file_path = os.path.join(output_dir, f"slice_{index:03d}_{original}")

            code = curl_get(url, file_path)
            if code == 200:
                success_count += 1
                print(f"[{index+1:03d}/{total}] OK  -> slice_{index:03d}_{original}")
            else:
                print(f"[{index+1:03d}/{total}] FAIL HTTP {code} | {url}")

        total_success += success_count
        print(f"\nSeries {si}: Da tai {success_count}/{total} anh")

    print(f"\n=== HOAN THANH TOAN BO ===")
    print(f"Tong da tai: {total_success}/{total_all} anh")
    print(f"Thu muc goc: {os.path.join(DOWNLOADS_DIR, folder_name)}")

if __name__ == "__main__":
    download_radiopaedia_stack('data.json')
