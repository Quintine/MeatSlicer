#!/usr/bin/env python3
"""Blender 5.2: orthographic stills of each weapon_<id>.glb."""

from __future__ import annotations

import argparse
import math
import sys
from pathlib import Path

import bpy
from mathutils import Vector


MAGENTA = (1.0, 0.0, 1.0, 1.0)


def parse_args(argv):
    parser = argparse.ArgumentParser()
    parser.add_argument("--in", dest="in_dir", required=True)
    parser.add_argument("--out", dest="out_dir", required=True)
    return parser.parse_args(argv)


def reset_scene():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    scene = bpy.context.scene
    scene.render.engine = "BLENDER_EEVEE"
    scene.render.resolution_x = 1024
    scene.render.resolution_y = 1024
    scene.render.film_transparent = False
    scene.render.image_settings.file_format = "PNG"
    scene.render.image_settings.color_mode = "RGBA"
    world = bpy.data.worlds.new("Magenta")
    scene.world = world
    world.use_nodes = True
    bg = world.node_tree.nodes.get("Background")
    if bg:
        bg.inputs[0].default_value = MAGENTA
        bg.inputs[1].default_value = 1.0
    light_data = bpy.data.lights.new("Sun", "SUN")
    light_data.energy = 5.0
    light = bpy.data.objects.new("Sun", light_data)
    scene.collection.objects.link(light)
    light.location = (-1.0, -1.0, 2.0)
    light.rotation_euler = (math.atan2(math.hypot(1, 1), 2), 0.0, math.atan2(-1, -1))
    cam_data = bpy.data.cameras.new("Cam")
    cam_data.type = "ORTHO"
    cam_data.ortho_scale = 2.4
    cam = bpy.data.objects.new("Cam", cam_data)
    scene.collection.objects.link(cam)
    scene.camera = cam
    return scene, cam


def import_weapon(path: Path):
    before = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=str(path))
    imported = [obj for obj in bpy.data.objects if obj not in before]
    meshes = [obj for obj in imported if obj.type == "MESH"]
    if not meshes:
        return None
    bpy.ops.object.select_all(action="DESELECT")
    for obj in meshes:
        obj.select_set(True)
    bpy.context.view_layer.objects.active = meshes[0]
    if len(meshes) > 1:
        bpy.ops.object.join()
    joined = bpy.context.view_layer.objects.active
    return joined


def normalize_weapon(obj):
    bpy.context.view_layer.update()
    bbox = [obj.matrix_world @ Vector(corner) for corner in obj.bound_box]
    min_c = Vector((min(v.x for v in bbox), min(v.y for v in bbox), min(v.z for v in bbox)))
    max_c = Vector((max(v.x for v in bbox), max(v.y for v in bbox), max(v.z for v in bbox)))
    size = max_c - min_c
    longest = max(size.x, size.y, size.z, 1e-6)
    scale = 2.0 / longest
    obj.scale *= scale
    bpy.context.view_layer.update()
    bbox = [obj.matrix_world @ Vector(corner) for corner in obj.bound_box]
    center = sum(bbox, Vector()) / 8.0
    obj.location -= center
    bpy.context.view_layer.update()
    bbox = [obj.matrix_world @ Vector(corner) for corner in obj.bound_box]
    min_c = Vector((min(v.x for v in bbox), min(v.y for v in bbox), min(v.z for v in bbox)))
    max_c = Vector((max(v.x for v in bbox), max(v.y for v in bbox), max(v.z for v in bbox)))
    size = max_c - min_c
    axis = max(((size.x, "x"), (size.y, "y"), (size.z, "z")))[1]
    if axis == "y":
        obj.rotation_euler[2] += -math.pi / 2
    elif axis == "z":
        obj.rotation_euler[1] += math.pi / 2
    bpy.context.view_layer.update()
    bbox = [obj.matrix_world @ Vector(corner) for corner in obj.bound_box]
    center = sum(bbox, Vector()) / 8.0
    obj.location -= center
    bpy.context.view_layer.update()


def aim_camera(cam, location):
    cam.location = location
    direction = Vector((0.0, 0.0, 0.0)) - Vector(location)
    cam.rotation_euler = direction.to_track_quat("-Z", "Y").to_euler()


def render_to(scene, path: Path):
    scene.render.filepath = str(path)
    bpy.ops.render.render(write_still=True)


def main(argv):
    args = parse_args(argv)
    in_dir = Path(args.in_dir)
    out_dir = Path(args.out_dir)
    out_dir.mkdir(parents=True, exist_ok=True)
    glbs = sorted(in_dir.glob("weapon_*.glb"))
    for glb in glbs:
        wid = glb.stem[len("weapon_") :]
        scene, cam = reset_scene()
        obj = import_weapon(glb)
        if obj is None:
            print(f"skip {glb.name}: no mesh")
            continue
        normalize_weapon(obj)
        aim_camera(cam, (0.0, 0.0, 4.0))
        render_to(scene, out_dir / f"wt_{wid}.png")
        aim_camera(cam, (0.0, -3.2, 1.4))
        render_to(scene, out_dir / f"w_{wid}.png")
        print(f"rendered {wid}")


if __name__ == "__main__":
    argv = sys.argv
    if "--" in argv:
        argv = argv[argv.index("--") + 1 :]
    else:
        argv = []
    main(argv)
