import socket, json, time

def blender_exec(code, timeout=60):
    s = socket.socket()
    s.settimeout(timeout)
    s.connect(('127.0.0.1', 9876))
    req = json.dumps({"type": "execute_code", "params": {"code": code}})
    s.sendall(req.encode() + b'\n')
    time.sleep(3)
    try:
        resp = b""
        while True:
            try:
                chunk = s.recv(65536)
                if not chunk: break
                resp += chunk
            except: break
        s.close()
        data = json.loads(resp.decode('utf-8', errors='replace'))
        r = data.get('result', {})
        out = r.get('result', '') if isinstance(r, dict) else str(r)
        print("STATUS:", data.get('status'))
        print("OUTPUT:", out[:1000])
        if data.get('message'): print("MSG:", data.get('message'))
        return data.get('status') == 'success'
    except Exception as e:
        s.close()
        print("Error:", e)
        return False

print("=== Testing export ===")
blender_exec(r"""
import bpy, os, traceback

out_path = r"C:\Users\User\Documents\Competition Project\AI4Sustainability Hackfest\assets\LightExchange_DigitalTwin.glb"

try:
    result = bpy.ops.export_scene.gltf(
        filepath         = out_path,
        export_format    = 'GLB',
        use_selection    = False,
        export_apply     = True,
        export_materials = 'EXPORT',
        export_colors    = True,
        export_normals   = True,
        export_texcoords = True,
        export_yup       = True,
        export_cameras   = False,
        export_lights    = False,
    )
    size_mb = os.path.getsize(out_path) / 1024 / 1024
    print(f"RESULT: {result}")
    print(f"SUCCESS: {out_path}")
    print(f"SIZE: {size_mb:.2f} MB")
except Exception as e:
    print(f"ERROR: {e}")
    traceback.print_exc()
""", timeout=90)
