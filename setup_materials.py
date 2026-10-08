import socket, json, time

def blender_exec(code, timeout=20):
    s = socket.socket()
    s.settimeout(timeout)
    s.connect(('127.0.0.1', 9876))
    req = json.dumps({"type": "execute_code", "params": {"code": code}})
    s.sendall(req.encode() + b'\n')
    time.sleep(1.5)
    try:
        resp = s.recv(262144)
        s.close()
        data = json.loads(resp.decode('utf-8', errors='replace'))
        r = data.get('result', {})
        print(r.get('result', '')[:600] if isinstance(r, dict) else str(r)[:300])
        return data.get('status') == 'success'
    except Exception as e:
        s.close()
        print("Error:", e)
        return False

# ============================================================
# FIX 1: Switch to EEVEE + enable reflections & AO
# Eevee handles architectural glass FAR better than Cycles
# for viewport previewing
# ============================================================
print("=== FIX 1: Switch to EEVEE ===")
blender_exec("""
import bpy
scene = bpy.context.scene
scene.render.engine = 'BLENDER_EEVEE'

eevee = scene.eevee
eevee.use_ssr          = True   # Screen Space Reflections (makes glass reflective!)
eevee.use_ssr_refraction = True
eevee.ssr_quality      = 1.0
eevee.ssr_max_roughness = 0.2
eevee.use_gtao         = True   # Ambient Occlusion
eevee.gtao_distance    = 0.5
eevee.use_bloom        = True   # Bloom for glass glow
eevee.bloom_threshold  = 0.8
eevee.bloom_intensity  = 0.05
eevee.taa_render_samples = 64
eevee.taa_samples      = 16

# Color management
scene.view_settings.view_transform = 'Filmic'
scene.view_settings.look           = 'Medium High Contrast'
scene.view_settings.exposure       = 0.8

# Switch viewport to rendered
for area in bpy.context.screen.areas:
    if area.type == 'VIEW_3D':
        for space in area.spaces:
            if space.type == 'VIEW_3D':
                space.shading.type = 'RENDERED'
print("Switched to EEVEE!")
""")

# ============================================================
# FIX 2: Rebuild Glass_Curtain as REFLECTIVE (not transmissive)
# Real architectural glass = mirror-like reflection of the sky
# ============================================================
print("=== FIX 2: Reflective Glass Curtain Wall ===")
blender_exec("""
import bpy

mat = bpy.data.materials.get('Glass_Curtain')
if not mat: mat = bpy.data.materials.new('Glass_Curtain')
mat.use_nodes = True
mat.blend_method = 'OPAQUE'

for n in mat.node_tree.nodes: mat.node_tree.nodes.remove(n)
N = mat.node_tree.nodes; L = mat.node_tree.links

OUT       = N.new('ShaderNodeOutputMaterial'); OUT.location = (1000, 0)
mix_final = N.new('ShaderNodeMixShader');      mix_final.location = (750, 0)
L.new(mix_final.outputs['Shader'], OUT.inputs['Surface'])

# --- GLASS PANE: reflective, dark blue ---
# Key: Metallic=0, Roughness=very low, Specular high
# This gives mirror-like sky reflection (how real glass looks)
glass = N.new('ShaderNodeBsdfPrincipled')
glass.location = (480, 200)
glass.inputs['Base Color'].default_value         = (0.06, 0.12, 0.22, 1)
glass.inputs['Metallic'].default_value           = 0.0
glass.inputs['Roughness'].default_value          = 0.0    # perfectly smooth = mirror
glass.inputs['Specular IOR Level'].default_value = 1.0    # max reflectivity
glass.inputs['IOR'].default_value               = 1.52
glass.inputs['Transmission Weight'].default_value = 0.0  # NO transmission = won't be black!
glass.inputs['Emission Color'].default_value     = (0.04, 0.08, 0.14, 1)
glass.inputs['Emission Strength'].default_value  = 0.05  # tiny self-glow to prevent pure black

# --- MULLION FRAME: bright anodised aluminium ---
mullion = N.new('ShaderNodeBsdfPrincipled')
mullion.location = (480, -150)
mullion.inputs['Base Color'].default_value         = (0.60, 0.62, 0.65, 1)
mullion.inputs['Metallic'].default_value           = 1.0
mullion.inputs['Roughness'].default_value          = 0.12
mullion.inputs['Specular IOR Level'].default_value = 1.0

# --- WINDOW GRID (Brick texture = grid pattern) ---
brick = N.new('ShaderNodeTexBrick'); brick.location = (100, 30)
brick.inputs['Color1'].default_value         = (0,0,0,1)
brick.inputs['Color2'].default_value         = (0,0,0,1)
brick.inputs['Mortar'].default_value         = (1,1,1,1)
brick.inputs['Scale'].default_value          = 1.0
brick.inputs['Mortar Size'].default_value    = 0.05   # mullion thickness
brick.inputs['Mortar Smooth'].default_value  = 0.0
brick.offset = 0.0           # grid (not staggered)
brick.squash = 0.65          # wider-than-tall window panes

# --- MAPPING ---
tc = N.new('ShaderNodeTexCoord'); tc.location = (-350, 30)
mp = N.new('ShaderNodeMapping');  mp.location = (-130, 30)
mp.inputs['Scale'].default_value = (20, 20, 25)  # columns x windows, rows z floors
L.new(tc.outputs['Object'],  mp.inputs['Vector'])
L.new(mp.outputs['Vector'],  brick.inputs['Vector'])

# fac=1 -> mullion, fac=0 -> glass
L.new(brick.outputs['Fac'],     mix_final.inputs['Fac'])
L.new(glass.outputs['BSDF'],    mix_final.inputs[1])
L.new(mullion.outputs['BSDF'],  mix_final.inputs[2])

print("Glass_Curtain rebuilt as reflective curtain wall!")
""")

# ============================================================
# FIX 3: Assign glass material to all glass facade objects
# ============================================================
print("=== FIX 3: Assign to facade objects ===")
blender_exec("""
import bpy

glass_mat = bpy.data.materials.get('Glass_Curtain')
if not glass_mat:
    print("No Glass_Curtain material found!")
else:
    targets = [
        'Facade_Main_Glass', 'Facade_Podium_Glass', 'Facade_Secondary_Tower',
        'Zone_D_Hyatt_Hotel', 'Zone_C_Offices'
    ]
    for name in targets:
        obj = bpy.context.scene.objects.get(name)
        if obj and obj.type == 'MESH':
            if not obj.data.materials:
                obj.data.materials.append(glass_mat)
            else:
                obj.data.materials[0] = glass_mat
            print(f"  Applied to {name}")

print("Glass material assigned!")
""")

# ============================================================
# FIX 4: Make zone meshes slightly visible (not pure black)
# ============================================================
print("=== FIX 4: Zone mesh colours ===")
blender_exec("""
import bpy

zones = {
    'Zone_Hotel':       (0.52, 0.20, 0.14),  # terracotta (hotel bands)
    'Zone_ME':          (0.20, 0.22, 0.24),  # dark grey
    'Zone_Hotel_BOH':   (0.22, 0.24, 0.26),  # slightly lighter grey
    'Zone_Podium':      (0.12, 0.18, 0.22),  # dark teal
    'Zone_Office_Warn': (0.10, 0.14, 0.20),  # very dark blue
    'Zone_Amenities':   (0.42, 0.15, 0.10),  # dark red
    'Zone_B_Podium':    (0.12, 0.18, 0.22),
    'Zone_A_ME_Plant':  (0.20, 0.22, 0.24),
    'Vertical_Core':    (0.18, 0.18, 0.20),
    'Podium_Concrete':  (0.12, 0.15, 0.18),
    'White_Band':       (0.52, 0.20, 0.14),  # terracotta
    'Mullion_Metal':    (0.60, 0.62, 0.65),  # silver aluminium
}

for matname, (r,g,b) in zones.items():
    mat = bpy.data.materials.get(matname)
    if not mat: mat = bpy.data.materials.new(matname)
    mat.use_nodes = True; mat.blend_method = 'OPAQUE'
    for n in mat.node_tree.nodes: mat.node_tree.nodes.remove(n)
    nd = mat.node_tree.nodes; lk = mat.node_tree.links
    out  = nd.new('ShaderNodeOutputMaterial'); out.location = (500,0)
    bsdf = nd.new('ShaderNodeBsdfPrincipled'); bsdf.location = (200,0)
    bsdf.inputs['Base Color'].default_value  = (r, g, b, 1)
    bsdf.inputs['Roughness'].default_value   = 0.75 if 'Metal' not in matname else 0.12
    bsdf.inputs['Metallic'].default_value    = 1.0 if 'Metal' in matname else 0.0
    lk.new(bsdf.outputs['BSDF'], out.inputs['Surface'])
    print(f"  {matname}")

print("All zone materials done!")
""")

# ============================================================
# FIX 5: Strong lighting so nothing is black
# ============================================================
print("=== FIX 5: Lighting fix ===")
blender_exec("""
import bpy, math, mathutils

scene = bpy.context.scene

# Simple strong sky
world = scene.world
if not world: world = bpy.data.worlds.new('World'); scene.world = world
world.use_nodes = True
for n in world.node_tree.nodes: world.node_tree.nodes.remove(n)
bg  = world.node_tree.nodes.new('ShaderNodeBackground')
sky = world.node_tree.nodes.new('ShaderNodeTexSky')
ow  = world.node_tree.nodes.new('ShaderNodeOutputWorld')
sky.sky_type      = 'NISHITA'
sky.sun_elevation = math.radians(30)
sky.sun_rotation  = math.radians(220)
bg.inputs['Strength'].default_value = 2.5  # strong enough to light the glass
world.node_tree.links.new(sky.outputs['Color'], bg.inputs['Color'])
world.node_tree.links.new(bg.outputs['Background'], ow.inputs['Surface'])

# Boost all existing lights
for obj in scene.objects:
    if obj.type == 'LIGHT':
        if obj.name == 'Sun_Dusk':
            obj.data.type   = 'SUN'
            obj.data.energy = 6.0
            obj.data.color  = (1.0, 0.88, 0.72)
            obj.rotation_euler = mathutils.Euler(
                (math.radians(-45), 0, math.radians(30)), 'XYZ')
        elif obj.name == 'Lobby_Glow':
            obj.data.energy = 3000
            obj.data.color  = (1.0, 0.95, 0.80)
        elif obj.name == 'Rim_Light':
            obj.data.type   = 'AREA'
            obj.data.energy = 8000
            obj.data.color  = (0.50, 0.70, 1.0)
            try: obj.data.size = 40.0
            except: pass

# Colour management
scene.view_settings.view_transform = 'Filmic'
scene.view_settings.look           = 'Medium High Contrast'
scene.view_settings.exposure       = 1.0   # Brighter!
scene.view_settings.gamma          = 1.0

print("Lighting boosted!")
""")

print("")
print("=== ALL FIXES APPLIED ===")
print("The building should now be properly lit in Eevee.")
print("Glass uses reflective mode (no transmission) so it won't be black.")
print("Check your Blender viewport now!")
