import socket, json, time

def blender_exec(code, timeout=20):
    s = socket.socket()
    s.settimeout(timeout)
    s.connect(('127.0.0.1', 9876))
    req = json.dumps({"type": "execute_code", "params": {"code": code}})
    s.sendall(req.encode() + b'\n')
    time.sleep(1)
    try:
        resp = s.recv(262144)
        s.close()
        data = json.loads(resp.decode('utf-8', errors='replace'))
        if data.get('status') == 'success':
            return data.get('result', {})
        else:
            print("ERROR:", data.get('message', '?'))
            return None
    except Exception as e:
        s.close()
        print("Exception:", e)
        return None

# Step 1: Get all objects in the scene
result = blender_exec("""
import bpy, json
objs = []
for obj in bpy.context.scene.objects:
    mats = []
    if obj.type == 'MESH' and obj.data:
        mats = [m.name if m else 'None' for m in obj.data.materials]
    objs.append({
        "name": obj.name, 
        "type": obj.type, 
        "z": round(obj.location.z,2), 
        "cols": [c.name for c in obj.users_collection], 
        "mats": mats
    })
print(json.dumps(objs))
""")
if result:
    text = result.get('result', '')
    try:
        objs = json.loads(text.strip())
        with open('scene_info.json', 'w') as f:
            json.dump(objs, f, indent=2)
        print(f"Written {len(objs)} objects to scene_info.json")
        for o in objs[:30]:
            print(f"  {o['name']:40s} z={o['z']:8.1f}  cols={o['cols']}")
    except Exception as e:
        print("Parse error:", e)
        print("Raw:", text[:500])
