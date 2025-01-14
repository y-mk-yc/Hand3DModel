class Range
{
  constructor(max = null, min = null)
  {
    this.max = max;
    this.min = min;
  }

  toMap()
  {
    return {
      max: this.max,
      min: this.min,
    };
  }

  static fromMap(map)
  {
    return new Range(map.max, map.min);
  }
}

class ROM
{
  constructor(Yrotation = null, Xrotation = null, Zrotation = null)
  {
    this.Yrotation = Yrotation;
    this.Xrotation = Xrotation;
    this.Zrotation = Zrotation;
  }

  toMap()
  {
    return {
      Yrotation: this.Yrotation ? this.Yrotation.toMap() : null,
      Xrotation: this.Xrotation ? this.Xrotation.toMap() : null,
      Zrotation: this.Zrotation ? this.Zrotation.toMap() : null,
    };
  }

  static fromMap(map)
  {
    return new ROM(
      map.Yrotation ? Range.fromMap(map.Yrotation) : null,
      map.Xrotation ? Range.fromMap(map.Xrotation) : null,
      map.Zrotation ? Range.fromMap(map.Zrotation) : null
    );
  }
}

class Joints
{
  constructor(Yrotation = null, Xrotation = null, Zrotation = null, rom = null, state = null)
  {
    this.Yrotation = Yrotation;
    this.Xrotation = Xrotation;
    this.Zrotation = Zrotation;
    this.rom = rom;
    this.state = state;
  }

  toMap()
  {
    return {
      Yrotation: this.Yrotation,
      Xrotation: this.Xrotation,
      Zrotation: this.Zrotation,
      ROM: this.rom ? this.rom.toMap() : null,
      state: this.state,
    };
  }

  static fromMap(map)
  {
    return new Joints(
      map.Yrotation || null,
      map.Xrotation || null,
      map.Zrotation || null,
      map.ROM ? ROM.fromMap(map.ROM) : null,
      map.state || null
    );
  }
}

class JointExerciseState
{
  constructor(PatientID, duration, right = null, left = null)
  {
    this.PatientID = PatientID;
    this.duration = duration;
    this.right = right;
    this.left = left;
  }

  toMap()
  {
    return {
      PatientID: this.PatientID,
      duration: this.duration,
      right: this.right
        ? Object.fromEntries(
          Object.entries(this.right).map(([key, value]) => [key, value.toMap()])
        )
        : null,
      left: this.left
        ? Object.fromEntries(
          Object.entries(this.left).map(([key, value]) => [key, value.toMap()])
        )
        : null,
    };
  }

  static fromMap(map)
  {
    return new JointExerciseState(
      map.PatientID,
      map.duration,
      map.right
        ? Object.fromEntries(
          Object.entries(map.right).map(([key, value]) => [key, Joints.fromMap(value)])
        )
        : null,
      map.left
        ? Object.fromEntries(
          Object.entries(map.left).map(([key, value]) => [key, Joints.fromMap(value)])
        )
        : null
    );
  }
}

export { Range, ROM, Joints, JointExerciseState };


// const LeftHandJointNameMapping = {
//   Finger1Metacarpal: ;
//   Finger1Proximal: ;
//   Finger1Distal: ;
//   Finger2Metacarpal: ;
//   Finger2Proximal: ;
//   Finger2Medial: ;
//   Finger2Distal: ;
//   Finger3Metacarpal: ;
//   Finger3Proximal: ;
//   Finger3Medial: ;
//   Finger3Distal: ;
//   Finger4Metacarpal: ;
//   Finger4Proximal: ;
//   Finger4Medial: ;
//   Finger4Distal: ;
//   Finger5Metacarpal: ;
//   Finger5Proximal: ;
//   Finger5Medial: ;
//   Finger5Distal: ;
//   // Add all other mappings here...
// };