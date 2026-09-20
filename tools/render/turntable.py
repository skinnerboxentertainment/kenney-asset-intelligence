"""
Cardinal-bearing turntable renderer.

Produces the same artifact Kenney ships for a handful of packs -- four
orthographic isometric PNGs per model, 90 degrees apart -- for any model, so a
3D asset can be searched, described and judged without ever loading the mesh.

Run headless:
  blender -b -P tools/render/turntable.py -- --in <dir> --out <dir> [options]

Deliberate choices:

* Orthographic, not perspective. Isometric tiles have to align edge to edge;
  a perspective camera makes the same block a different width depending on
  where it sits in frame.
* Elevation is atan(1/sqrt(2)) = 35.264 deg, the true isometric angle, so a
  cube's three visible faces are equal. Game "isometric" is often 30 deg
  (dimetric); this is switchable with --elevation.
* Transparent film. These composite onto whatever ground the viewer uses.
* Fixed three-light rig with flat world ambient, identical for every model, so
  colour is comparable across a pack rather than varying per render.
* Raw view transform and specular suppressed. Blender 4.x defaults to AgX,
  which deliberately desaturates -- right for photoreal film, wrong here.
  Measured against Kenney's own renders of racing-kit, AgX landed 96 units of
  RGB distance from their colour and Standard 85; Raw with flat shading and
  these light energies lands at 14.9 out of a possible 441.
* Output is <name>_<BEARING>.png in an Isometric/ folder -- exactly Kenney's
  own convention, so everything downstream that already reads their renders
  reads these too with no changes.
"""

import argparse
import json
import math
import os
import sys

import bpy
from mathutils import Vector

# Kenney's own naming, and the order a turntable steps through.
BEARINGS = ["NE", "SE", "SW", "NW"]
ISO_ELEVATION = math.degrees(math.atan(1.0 / math.sqrt(2.0)))  # 35.264...

IMPORTERS = {
    ".glb": lambda p: bpy.ops.import_scene.gltf(filepath=p),
    ".gltf": lambda p: bpy.ops.import_scene.gltf(filepath=p),
    ".obj": lambda p: bpy.ops.wm.obj_import(filepath=p),
    ".fbx": lambda p: bpy.ops.import_scene.fbx(filepath=p),
    ".dae": lambda p: bpy.ops.wm.collada_import(filepath=p),
}


def argv_after_dashes():
    return sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []


def clear_scene():
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)
    for block in (bpy.data.meshes, bpy.data.materials, bpy.data.images):
        for item in list(block):
            if item.users == 0:
                block.remove(item)


def world_bounds(objects):
    """Axis-aligned bounds of everything imported, in world space."""
    lo = Vector((math.inf,) * 3)
    hi = Vector((-math.inf,) * 3)
    found = False
    for obj in objects:
        if obj.type != "MESH":
            continue
        found = True
        for corner in obj.bound_box:
            p = obj.matrix_world @ Vector(corner)
            lo = Vector((min(lo[i], p[i]) for i in range(3)))
            hi = Vector((max(hi[i], p[i]) for i in range(3)))
    if not found:
        return None, None
    return lo, hi


def build_lights(key_e=2.9, fill_e=0.81, ambient=0.41):
    """One rig for every model, so colour is comparable across a pack."""
    key = bpy.data.lights.new("key", type="SUN")
    key.energy = key_e
    key.angle = math.radians(12)
    key_obj = bpy.data.objects.new("key", key)
    key_obj.rotation_euler = (math.radians(52), 0, math.radians(40))
    bpy.context.collection.objects.link(key_obj)

    fill = bpy.data.lights.new("fill", type="SUN")
    fill.energy = fill_e
    fill_obj = bpy.data.objects.new("fill", fill)
    fill_obj.rotation_euler = (math.radians(65), 0, math.radians(-125))
    bpy.context.collection.objects.link(fill_obj)

    world = bpy.data.worlds.new("flat")
    world.use_nodes = True
    bg = world.node_tree.nodes["Background"]
    bg.inputs[0].default_value = (1, 1, 1, 1)
    bg.inputs[1].default_value = ambient
    bpy.context.scene.world = world


def setup_render(size, samples, view_transform="Standard"):
    scene = bpy.context.scene
    scene.render.engine = "BLENDER_EEVEE_NEXT"
    scene.render.film_transparent = True
    scene.render.resolution_x = size
    scene.render.resolution_y = size
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = "PNG"
    scene.render.image_settings.color_mode = "RGBA"
    try:
        scene.eevee.taa_render_samples = samples
    except AttributeError:
        pass
    # Blender 4.x defaults to AgX, which deliberately desaturates highlights --
    # correct for photoreal film, wrong for flat asset previews where the point
    # is that the colour matches the material.
    try:
        scene.view_settings.view_transform = view_transform
    except (TypeError, ValueError):
        pass


def place_camera(cam_obj, centre, radius, azimuth_deg, elevation_deg, margin):
    """Orbit the camera to a compass bearing and frame the whole model."""
    az = math.radians(azimuth_deg)
    el = math.radians(elevation_deg)
    direction = Vector((math.cos(el) * math.sin(az),
                        -math.cos(el) * math.cos(az),
                        math.sin(el)))
    cam_obj.location = centre + direction * (radius * 4.0 + 1.0)

    # Point at the model: -Z is the camera's forward axis in Blender.
    cam_obj.rotation_euler = (-direction).to_track_quat("-Z", "Y").to_euler()
    cam_obj.data.ortho_scale = radius * 2.0 * margin


def render_model(path, out_dir, opts):
    name = os.path.splitext(os.path.basename(path))[0]
    ext = os.path.splitext(path)[1].lower()
    importer = IMPORTERS.get(ext)
    if importer is None:
        return {"model": name, "ok": False, "error": f"no importer for {ext}"}

    clear_scene()
    before = set(bpy.data.objects)
    try:
        importer(path)
    except Exception as exc:  # noqa: BLE001 - report, keep going
        return {"model": name, "ok": False, "error": f"import failed: {exc}"}
    imported = [o for o in bpy.data.objects if o not in before]

    lo, hi = world_bounds(imported)
    if lo is None:
        return {"model": name, "ok": False, "error": "no mesh in file"}

    centre = (lo + hi) / 2.0
    radius = max((hi - lo).length / 2.0, 1e-4)

    if not opts.gloss:
        for mat in bpy.data.materials:
            if not mat.use_nodes:
                continue
            for node in mat.node_tree.nodes:
                if node.type != "BSDF_PRINCIPLED":
                    continue
                for key, val in (("Specular IOR Level", 0.0), ("Roughness", 1.0),
                                 ("Metallic", 0.0), ("Sheen Weight", 0.0)):
                    if key in node.inputs:
                        node.inputs[key].default_value = val
    build_lights(opts.key, opts.fill, opts.ambient)
    cam_data = bpy.data.cameras.new("cam")
    cam_data.type = "ORTHO"
    cam_obj = bpy.data.objects.new("cam", cam_data)
    bpy.context.collection.objects.link(cam_obj)
    bpy.context.scene.camera = cam_obj

    written = []
    for i, bearing in enumerate(opts.bearings):
        azimuth = opts.azimuth0 + i * (360.0 / len(opts.bearings))
        place_camera(cam_obj, centre, radius, azimuth, opts.elevation, opts.margin)
        out = os.path.join(out_dir, f"{name}_{bearing}.png")
        bpy.context.scene.render.filepath = out
        bpy.ops.render.render(write_still=True)
        written.append(os.path.basename(out))

    return {"model": name, "ok": True, "files": written,
            "size": [round(v, 4) for v in (hi - lo)]}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--in", dest="src", required=True, help="directory of model files")
    ap.add_argument("--out", dest="dst", required=True, help="output directory")
    ap.add_argument("--ext", default=".glb", help="model extension to render")
    ap.add_argument("--size", type=int, default=512)
    ap.add_argument("--samples", type=int, default=24)
    ap.add_argument("--margin", type=float, default=1.12, help="framing headroom; 1.0 is tight")
    ap.add_argument("--elevation", type=float, default=ISO_ELEVATION)
    ap.add_argument("--azimuth0", type=float, default=45.0, help="azimuth of the first bearing")
    ap.add_argument("--bearings", default=",".join(BEARINGS))
    ap.add_argument("--key", type=float, default=2.9, help="key sun energy")
    ap.add_argument("--fill", type=float, default=0.81, help="fill sun energy")
    ap.add_argument("--ambient", type=float, default=0.41, help="flat world ambient")
    ap.add_argument("--steps", type=int, default=0,
                    help="render N evenly spaced bearings named by degrees, e.g. 24 for 15-degree steps")
    ap.add_argument("--view", default="Raw", help="colour view transform")
    ap.add_argument("--gloss", action="store_true",
                    help="keep material specular; off by default, it desaturates flat art")
    ap.add_argument("--only", default="", help="render just this model name")
    ap.add_argument("--limit", type=int, default=0)
    ap.add_argument("--report", default="")
    opts = ap.parse_args(argv_after_dashes())
    if opts.steps:
        # Billboard impostors: N sprites around the compass, named by the
        # azimuth they were shot at, so a runtime can pick by view angle.
        step = 360.0 / opts.steps
        opts.bearings = [f"{int(round(i * step)):03d}" for i in range(opts.steps)]
    else:
        opts.bearings = [b for b in opts.bearings.split(",") if b]

    # Blender resolves relative render paths against its own notion of cwd,
    # not the shell's -- a relative --out silently lands in C:\ on Windows.
    opts.src = os.path.abspath(opts.src)
    opts.dst = os.path.abspath(opts.dst)
    os.makedirs(opts.dst, exist_ok=True)
    setup_render(opts.size, opts.samples, opts.view)

    models = sorted(f for f in os.listdir(opts.src) if f.lower().endswith(opts.ext))
    if opts.only:
        models = [f for f in models if os.path.splitext(f)[0] == opts.only]
    if opts.limit:
        models = models[:opts.limit]

    results = []
    for i, f in enumerate(models, 1):
        r = render_model(os.path.join(opts.src, f), opts.dst, opts)
        results.append(r)
        print(f"[{i}/{len(models)}] {r['model']}: "
              f"{'ok' if r['ok'] else 'FAILED ' + r.get('error', '')}", flush=True)

    ok = sum(1 for r in results if r["ok"])
    print(f"\nrendered {ok}/{len(models)} models x {len(opts.bearings)} bearings")
    if opts.report:
        with open(opts.report, "w", encoding="utf-8") as fh:
            json.dump({"results": results, "bearings": opts.bearings,
                       "elevation": opts.elevation, "azimuth0": opts.azimuth0}, fh, indent=2)


main()
