import Asistencia from "../models/asistencias.js"
import mongoose from "mongoose"
import Estudiantes from "../models/estudiantes.js"
import Cursos from "../models/cursos.js"
import reconocimientoFacial from "./reconocimiento_facial.js"
//import reconocimientoFacial from "./reconocimiento_facial.js"
//import Actuaciones from "../models/actuaciones.js"
//Gestionar asistencias
import { descargarImgsEstudiantes, eliminarCarpetaTemporal } from "../service/imgs_cloudinary.js"

//Crear asistencia
//Esto es para la IA
// const crearAsistencia = async(req, res)=>{
//     const {estudiante} = req.body
//     try {
//         if(Object.values(req.body).includes("")) return res.status(400).json({msg: "Lo sentimos todos los campos deben de estar llenos"})
//         const asistenciaEncontrada = await Asistencia.findOne({estudiante})
//         if(asistenciaEncontrada) return res.status(404).json({msg: "Lo sentimos pero esta asistencia ya esta registrada"})
//         const estudianteEncontrado = await Estudiantes.findById(estudiante)
//         if(!estudianteEncontrado) return res.status(404).json({msg: "No se a podido crear la asistencia, ya que el estudiante no existe"})
        
//         const asistenciaNueva = new Asistencia(req.body)
//         await asistenciaNueva.save()

//         res.status(200).json({msg: "Asistencia creada con éxito"})
        
//     } catch (error) {
//         res.status(500).send(`Hubo un problema con el servidor - Error ${error.message}`)   
//     }
// }

//Visualizar asistencias
const visualizarAsistencias = async(req, res)=>{
    const {materia, paralelo} = req.body
    try {
        if(Object.values(req.body).includes("") || materia === undefined) return res.status(400).json({msg: "Lo sentimos todos los campos deben de estar llenos"})
        const cursoEncontrado = await Cursos.findOne({materia: materia, paralelo: paralelo})
        if(!cursoEncontrado) return res.status(404).json({msg: "Lo sentimos pero no se ha podido encontra el curso"})

        const asistenciasEncontradas = await Asistencia.find({curso: cursoEncontrado?._id})
        console.log(asistenciasEncontradas)
        if(asistenciasEncontradas.length === 0) return res.status(400).json({msg: "Lo sentimos pero no se encuentraron asistencias registradas con esa materia o paralelo"})
        if(!asistenciasEncontradas) return res.status(400).json({msg: "Lo sentimos pero esta asistencia no existe"})      
        
        //Descargar de manera temporal las imagenes de los estudiantes del curso
        let estudiantesURLS = [] 
        
        for (const estudianteId of cursoEncontrado?.estudiantes){
            try {                
                const estudianteEncontrado = await Estudiantes.findById(estudianteId.toString())              
                if(estudianteEncontrado?.fotografia){
                    estudiantesURLS.push(estudianteEncontrado?.fotografia)
                }
            } catch (error) {
                console.error(`Error al encontrar el ID del estudiante ${estudianteId}: ${error.message}`)
            }
        }
            
        if(estudiantesURLS.length === 0) return res.status().json({msg: "No se encontraron fotografías de estudiantes"})

        console.log("LAS URLS son: ",estudiantesURLS)


        await descargarImgsEstudiantes(estudiantesURLS, `${cursoEncontrado?.materia}-${cursoEncontrado?.paralelo}`)

        res.status(200).json(asistenciasEncontradas)
    } catch (error) {
        res.status(500).send(`Hubo un problema con el servidor - Error ${error.message}`)   
    }
}

//Visualizar asistencia
const visualizarAsistencia = async(req, res)=>{
    const {id} = req.params
    try {
        if(!mongoose.Types.ObjectId.isValid(id)) return res.status(404).json({msg: "Lo sentimos pero el id no es válido"})
        const asistenciaEncontrada = await Asistencia.findById(id)
        if(!asistenciaEncontrada) return res.status(400).json({msg: "Lo sentimos pero la asistencia no se encuentra registrada"})
        res.status(200).json(asistenciaEncontrada)
    } catch (error) {
        res.status(500).send(`Hubo un problema con el servidor - Error ${error.message}`)   
    }
}

//Actualizar asistencia - SE SUPONE QUE AQUI VA LA IA
const actualizarAsistencia = async(req, res)=>{
    const {materia, paralelo, estudiantes, fecha} = req.body
    try {
        //if(!mongoose.Types.ObjectId.isValid(id)) return res.status(404).json({msg: "Lo sentimos pero el id no es válido"})
        if(Object.values(req.body).includes("")) return res.status(400).json({msg: "Lo sentimos todos los campos deben de estar llenos"})
        
        const cursoEncontrado = await Cursos.findOne({materia: materia, paralelo: paralelo})
        if(!cursoEncontrado) return res.status(404).json({msg: "Lo sentimos pero no se ha podido encontra el curso"})

        //MEJORAR ESTO
        
        const asistenciasActualizadas = await Promise.all(
            estudiantes.map(async(asistencia)=>{
                // const actuacionEncontrada = await Actua
                const asistenciaEncontrada = await Asistencia.findOne({curso: cursoEncontrado._id, estudiante: asistencia.estudianteId, _id: asistencia.asistenciaId})
                if(!asistenciaEncontrada) return res.status(400).json({msg: `Lo sentimos, la asistencia con ID ${asistencia?._id} no se encuentra registrada`})
            
                asistenciaEncontrada.fecha_asistencias.push(fecha)

                if(asistencia.estado === "presente"){
                    asistenciaEncontrada.cantidad_asistencias+=1
                    asistenciaEncontrada.cantidad_presentes+=1
                    asistenciaEncontrada.estado_asistencias.push(asistencia.estado)
                    
                } else {
                    if(asistencia.estado === "ausente"){
                        asistenciaEncontrada.cantidad_asistencias+=1
                        asistenciaEncontrada.cantidad_ausencias+=1
                        asistenciaEncontrada.estado_asistencias.push(asistencia.estado)
                    }

                }
            
                await asistenciaEncontrada.save()
                return asistenciaEncontrada

            })
        )

        //Eliminar carpeta temporal de imgs cuando se actualiza las asistencias
        eliminarCarpetaTemporal(`${cursoEncontrado?.materia}-${cursoEncontrado?.paralelo}`)

        res.status(200).json({
            msg: "Asistencias registradas con éxito",
            asistencias: asistenciasActualizadas
        })
    } catch (error) {
        res.status(500).send(`Hubo un problema con el servidor - Error ${error.message}`)   
    }
}

//Eliminar asistencia
const eliminarAsistencia = async(req, res)=>{
    const {id} = req.params
    try {
        if(!mongoose.Types.ObjectId.isValid(id)) return res.status(404).json({msg: "Lo sentimos pero el id no es válido"})
        const asistenciaEncontrada = await Asistencia.findByIdAndDelete(id)
        if(!asistenciaEncontrada) return res.status(404).json({msg: "Lo sentimos pero la asistencia no se encuentra registrado"})
        res.status(200).json({msg: "Asistencia eliminada con éxito"})        
    } catch (error) {
        res.status(500).send(`Hubo un problema con el servidor - Error ${error.message}`)   
    }
}

// //Visualizar reporte de asistencias

const visualizarReporte = async (req, res) => {
    const { fecha, materia, paralelo } = req.body;

    try {
        if (Object.values(req.body).includes(""))  return res.status(400).json({ msg: "Todos los campos deben de estar llenos." })
        const cursoEncontrado = await Cursos.findOne({ materia, paralelo })
        if (!cursoEncontrado) return res.status(404).json({ msg: "No se ha podido encontrar el curso." })
        
        const asistencias = await Asistencia.find({ curso: cursoEncontrado._id }).populate("estudiante", "nombre apellido -_id")
        if (asistencias.length === 0) return res.status(400).json({ msg: "No se encontraron asistencias registradas." })
        
        // Si se proporciona una fecha, filtrar asistencias por esa fecha
        if (fecha) {
            const asistenciasFiltradas = asistencias
                .filter(asistencia => asistencia.fecha_asistencias.includes(fecha))
                .map(asistencia => {
                    const indiceFecha = asistencia.fecha_asistencias.indexOf(fecha);
                    return {
                        estudiante: asistencia.estudiante,
                        estadoAsistencia: asistencia.estado_asistencias[indiceFecha],
                        fecha
                    };
                });

            if (asistenciasFiltradas.length === 0) {
                return res.status(404).json({ msg: "La fecha especificada no se encuentra registrada." });
            }

            return res.status(200).json(asistenciasFiltradas);
        }

        // Si no se proporciona fecha, devolver todas las asistencias y estudiantes
        const resultadoCompleto = asistencias.map(asistencia => ({
            estudiante: asistencia.estudiante,
            fechasAsistencias: asistencia.fecha_asistencias,
            estadosAsistencias: asistencia.estado_asistencias,
            cantidadAsistencias: asistencia.cantidad_asistencias,
            cantidadPresentes: asistencia.cantidad_presentes,
            cantidadAusencias: asistencia.cantidad_ausencias
        }));

        res.status(200).json(resultadoCompleto);

    } catch (error) {
        res.status(500).json({ msg: `Hubo un problema con el servidor: ${error.message}` });
    }
};



export{
    // crearAsistencia,
    visualizarAsistencias,
    visualizarAsistencia,
    actualizarAsistencia,
    eliminarAsistencia,
    visualizarReporte
}