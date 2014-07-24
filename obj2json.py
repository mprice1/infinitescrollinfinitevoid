import sys
objfile_name = sys.argv[1]
jsonfile_name = sys.argv[2]
print "OBJ file to read: ", objfile_name
print "JSON file to write: ", jsonfile_name
print "Opening files..."

try:
    objfile = open(objfile_name)
except IOError:
    print "Error loading OBJ file!"
    exit(1)

print "done"

positions = []
normals = []
texs = []
faces = []
AABBmax = [float("-inf"), float("-inf"), float("-inf")]
AABBmin = [float("inf"), float("inf"), float("inf")]
def parseFace(words):
    face = []
    words.pop(0)
    for word in words:
        face.append(word.split('/'))
    faces.append(face)

try:
    for line in objfile.readlines():
        line = line.replace("\r\n","")
        line = line.replace("  "," ")
        line = line.strip()
        words = line.split(' ')
        if line == "":
            continue
        elif words[0] == '#':
            continue
        elif words[0] == 'v':
            positions.append([words[1], words[2], words[3]])
            for i in range(0,3):
                if float(words[i+1]) < AABBmin[i]:
                    AABBmin[i] = float(words[i+1])
                elif float(words[i+1]) > AABBmax[i]:
                    AABBmax[i] = float(words[i+1])
        elif words[0] == 'vt':
            texs.append([words[1], words[2]])
        elif words[0] == 'vn':
            normals.append([words[1], words[2], words[3]])
        elif words[0] == 'f':
            if len(words) != 4:
                print "Skipping non-triangle face."
                continue
            else:
                parseFace(words)
        else:
            print "Unknown line start: ", words[0]
except:
    print "Error parsing OBJ!"
    exit(1)

try:
    jsonfile = open(jsonfile_name, 'w')
except IOError:
    print "Error opening output file!"
    exit(1)


expanded_verts = []
expanded_norms = []
expanded_texs = []
outindices = []
idxmap = {}
curidx = 0
for face in faces:
    for pt in face:
        if str(pt) in idxmap:
            outindices.append(idxmap[str(pt)])
        else:
            idxmap[str(pt)] = curidx
            curidx = curidx + 1
            print pt
            print len(positions)
            expanded_verts.append(positions[int(pt[0])-1])
            expanded_texs.append(texs[int(pt[1])-1])
            expanded_norms.append(normals[int(pt[2])-1])
            outindices.append(curidx - 1)
        
        


jsonfile.write("{")
outverts = [item for sublist in expanded_verts for item in sublist]
jsonfile.write('"vertexPositions" : ')
jsonfile.write(str(outverts).replace("'",""))
jsonfile.write(',');

outnorms = [item for sublist in expanded_norms for item in sublist]
jsonfile.write('"vertexNormals" : ')
jsonfile.write(str(outnorms).replace("'",""))
jsonfile.write(',');

outtexs = [item for sublist in expanded_texs for item in sublist]
jsonfile.write('"vertexTextureCoords" : ')
jsonfile.write(str(outtexs).replace("'",""))
jsonfile.write(',');

jsonfile.write('"indices" : ')
jsonfile.write(str(outindices).replace("'",""))
jsonfile.write(',');

jsonfile.write('"AABBmax" : ')
jsonfile.write(str(AABBmax))
jsonfile.write(',')

jsonfile.write('"AABBmin" : ')
jsonfile.write(str(AABBmin))
jsonfile.write("}")
jsonfile.close()
