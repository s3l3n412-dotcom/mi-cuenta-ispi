const express = require("express");
const { createClient } = require("@supabase/supabase-js");
require("dotenv").config();

const app = express();

app.use(express.json());
app.use(express.static("public"));

const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_KEY
);

// ==========================================
// PÁGINA PRINCIPAL
// ==========================================

app.get("/", (req, res) => {
    res.sendFile(__dirname + "/public/index.html");
});

// ==========================================
// PRUEBA DE CONEXIÓN CON SUPABASE
// ==========================================

app.get("/prueba-supabase", async (req, res) => {
    try {
        const { data, error } = await supabase
            .from("alumnos")
            .select("*");

        if (error) {
            console.error("Error conectando con Supabase:", error);

            return res.status(500).json({
                error: "Error conectando con Supabase.",
                detalle: error.message,
                codigo: error.code || "",
                detalles: error.details || "",
                hint: error.hint || ""
            });
        }

        res.json({
            mensaje: "Conexión con Supabase funcionando correctamente",
            alumnos: data
        });

    } catch (error) {
        console.error("Error interno:", error);

        res.status(500).json({
            error: "Error interno del servidor.",
            detalle: error.message
        });
    }
});

// ==========================================
// CONSULTAR CUENTA DEL ALUMNO
// ==========================================

app.get("/api/cuenta/:dni", async (req, res) => {
    try {
        const dni = String(req.params.dni).trim();

        if (!/^\d{7,8}$/.test(dni)) {
            return res.status(400).json({
                error: "DNI inválido. Debe contener 7 u 8 números."
            });
        }

        const {
            data: alumno,
            error: errorAlumno
        } = await supabase
            .from("alumnos")
            .select("*")
            .eq("dni", dni)
            .maybeSingle();

        if (errorAlumno) {
            console.error("Error buscando alumno:", errorAlumno);

            return res.status(500).json({
                error: "Error buscando alumno.",
                detalle: errorAlumno.message,
                codigo: errorAlumno.code || "",
                detalles: errorAlumno.details || "",
                hint: errorAlumno.hint || ""
            });
        }

        if (!alumno) {
            return res.status(404).json({
                error: "Alumno no encontrado."
            });
        }

        const {
            data: cuotas,
            error: errorCuotas
        } = await supabase
            .from("cuotas")
            .select("*")
            .eq("alumno_id", alumno.id)
            .order("vencimiento", { ascending: true });

        if (errorCuotas) {
            console.error("Error buscando cuotas:", errorCuotas);

            return res.status(500).json({
                error: "Error al consultar las cuotas.",
                detalle: errorCuotas.message,
                codigo: errorCuotas.code || "",
                detalles: errorCuotas.details || "",
                hint: errorCuotas.hint || ""
            });
        }

        // ==========================================
        // CALCULAR SALDO
        // ==========================================

        const saldo = cuotas
            .filter(cuota => !cuota.pagado)
            .reduce((total, cuota) => {
                return total + Number(cuota.importe || 0);
            }, 0);

        // ==========================================
        // NO ENVIAR LA CONTRASEÑA AL FRONTEND
        // ==========================================

        const alumnoSeguro = { ...alumno };

        delete alumnoSeguro.contraseña;

        res.json({
            alumno: alumnoSeguro,
            cuotas: cuotas,
            saldo: saldo
        });

    } catch (error) {
        console.error("ERROR INTERNO:", error);

        res.status(500).json({
            error: "Error interno del servidor.",
            detalle: error.message
        });
    }
});

// ==========================================
// REGISTRAR NUEVO ALUMNO
// ==========================================

app.post("/api/alumnos", async (req, res) => {
    try {

        const {
            dni,
            nombre,
            apellido,
            email,
            telefono,
            carrera,
            curso,
            contraseña
        } = req.body;

        console.log("=================================");
        console.log("INTENTO DE REGISTRO");
        console.log("DNI:", dni);
        console.log("Nombre:", nombre);
        console.log("Apellido:", apellido);
        console.log("Email:", email);
        console.log("Teléfono:", telefono);
        console.log("Carrera:", carrera);
        console.log("Curso:", curso);
        console.log("=================================");

        // ==========================================
        // VALIDAR CAMPOS
        // ==========================================

        if (
            !dni ||
            !nombre ||
            !apellido ||
            !email ||
            !telefono ||
            !carrera ||
            !curso ||
            !contraseña
        ) {
            return res.status(400).json({
                error: "Todos los campos son obligatorios."
            });
        }

        // ==========================================
        // VALIDAR DNI
        // ==========================================

        if (!/^\d{7,8}$/.test(String(dni))) {
            return res.status(400).json({
                error: "DNI inválido. Debe contener 7 u 8 números."
            });
        }

        // ==========================================
        // VALIDAR EMAIL
        // ==========================================

        const emailValido =
            /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

        if (!emailValido.test(String(email))) {
            return res.status(400).json({
                error: "El correo electrónico no es válido."
            });
        }

        // ==========================================
        // VALIDAR CONTRASEÑA
        // ==========================================

        if (String(contraseña).length < 6) {
            return res.status(400).json({
                error: "La contraseña debe tener al menos 6 caracteres."
            });
        }

        // ==========================================
        // BUSCAR DNI EXISTENTE
        // ==========================================

        const {
            data: alumnoExistente,
            error: errorBusqueda
        } = await supabase
            .from("alumnos")
            .select("id")
            .eq("dni", String(dni))
            .maybeSingle();

        if (errorBusqueda) {
            console.error(
                "ERROR VERIFICANDO DNI:",
                errorBusqueda
            );

            return res.status(500).json({
                error: "No se pudo verificar el DNI.",
                detalle: errorBusqueda.message,
                codigo: errorBusqueda.code || "",
                detalles: errorBusqueda.details || "",
                hint: errorBusqueda.hint || ""
            });
        }

        if (alumnoExistente) {
            return res.status(409).json({
                error: "El DNI ya se encuentra registrado."
            });
        }

        // ==========================================
        // BUSCAR EMAIL EXISTENTE
        // ==========================================

        const {
            data: emailExistente,
            error: errorEmail
        } = await supabase
            .from("alumnos")
            .select("id")
            .eq("email", String(email).trim())
            .maybeSingle();

        if (errorEmail) {
            console.error(
                "ERROR VERIFICANDO EMAIL:",
                errorEmail
            );

            return res.status(500).json({
                error: "No se pudo verificar el correo electrónico.",
                detalle: errorEmail.message,
                codigo: errorEmail.code || "",
                detalles: errorEmail.details || "",
                hint: errorEmail.hint || ""
            });
        }

        if (emailExistente) {
            return res.status(409).json({
                error: "El correo electrónico ya se encuentra registrado."
            });
        }

        // ==========================================
        // INSERTAR ALUMNO
        // ==========================================

        const {
            data: nuevoAlumno,
            error: errorRegistro
        } = await supabase
            .from("alumnos")
            .insert([
                {
                    dni: String(dni),
                    nombre: String(nombre).trim(),
                    apellido: String(apellido).trim(),
                    email: String(email).trim(),
                    telefono: String(telefono).trim(),
                    carrera: String(carrera).trim(),
                    curso: Number(curso),
                    contraseña: String(contraseña)
                }
            ])
            .select()
            .single();

        if (errorRegistro) {

            console.error("=================================");
            console.error("ERROR COMPLETO AL REGISTRAR:");
            console.error("Mensaje:", errorRegistro.message);
            console.error("Código:", errorRegistro.code);
            console.error("Detalles:", errorRegistro.details);
            console.error("Hint:", errorRegistro.hint);
            console.error("Objeto completo:", errorRegistro);
            console.error("=================================");

            return res.status(500).json({
                error: "No se pudo registrar el alumno.",
                detalle: errorRegistro.message || "Error desconocido",
                codigo: errorRegistro.code || "",
                detalles: errorRegistro.details || "",
                hint: errorRegistro.hint || ""
            });
        }

        // ==========================================
        // OCULTAR CONTRASEÑA EN LA RESPUESTA
        // ==========================================

        const alumnoSeguro = { ...nuevoAlumno };

        delete alumnoSeguro.contraseña;

        console.log(
            "ALUMNO REGISTRADO CORRECTAMENTE:"
        );

        console.log(alumnoSeguro);

        res.status(201).json({
            mensaje: "Alumno registrado correctamente.",
            alumno: alumnoSeguro
        });

    } catch (error) {

        console.error("=================================");
        console.error("ERROR INTERNO REGISTRANDO ALUMNO:");
        console.error(error);
        console.error("=================================");

        res.status(500).json({
            error: "Error interno del servidor.",
            detalle: error.message
        });
    }
});

// ==========================================
// LOGIN
// ==========================================

app.post("/api/login", async (req, res) => {
    try {

        const {
            dni,
            contraseña
        } = req.body;

        // ==========================================
        // VALIDACIONES
        // ==========================================

        if (!dni || !contraseña) {
            return res.status(400).json({
                error: "Ingresá tu DNI y contraseña."
            });
        }

        const dniTexto = String(dni).trim();

        if (!/^\d{7,8}$/.test(dniTexto)) {
            return res.status(400).json({
                error: "El DNI debe contener 7 u 8 números."
            });
        }

        // ==========================================
        // BUSCAR ALUMNO
        // ==========================================

        const {
            data: alumno,
            error: errorAlumno
        } = await supabase
            .from("alumnos")
            .select("*")
            .eq("dni", dniTexto)
            .maybeSingle();

        if (errorAlumno) {
            console.error(
                "ERROR BUSCANDO ALUMNO PARA LOGIN:",
                errorAlumno
            );

            return res.status(500).json({
                error: "No se pudo verificar la cuenta.",
                detalle: errorAlumno.message,
                codigo: errorAlumno.code || "",
                detalles: errorAlumno.details || "",
                hint: errorAlumno.hint || ""
            });
        }

        if (!alumno) {
            return res.status(401).json({
                error: "El DNI o la contraseña son incorrectos."
            });
        }

        // ==========================================
        // VERIFICAR CONTRASEÑA
        // ==========================================

        if (
            String(alumno.contraseña) !==
            String(contraseña)
        ) {
            return res.status(401).json({
                error: "El DNI o la contraseña son incorrectos."
            });
        }

        // ==========================================
        // BUSCAR CUOTAS
        // ==========================================

        const {
            data: cuotas,
            error: errorCuotas
        } = await supabase
            .from("cuotas")
            .select("*")
            .eq("alumno_id", alumno.id)
            .order("vencimiento", { ascending: true });

        if (errorCuotas) {
            console.error(
                "ERROR BUSCANDO CUOTAS:",
                errorCuotas
            );

            return res.status(500).json({
                error: "La cuenta existe, pero no se pudieron cargar las cuotas.",
                detalle: errorCuotas.message,
                codigo: errorCuotas.code || "",
                detalles: errorCuotas.details || "",
                hint: errorCuotas.hint || ""
            });
        }

        // ==========================================
        // CALCULAR SALDO
        // ==========================================

        const saldo = cuotas
            .filter(cuota => !cuota.pagado)
            .reduce((total, cuota) => {
                return total + Number(cuota.importe || 0);
            }, 0);

        // ==========================================
        // OCULTAR CONTRASEÑA
        // ==========================================

        const alumnoSeguro = { ...alumno };

        delete alumnoSeguro.contraseña;

        // ==========================================
        // RESPUESTA
        // ==========================================

        res.json({
            mensaje: "Inicio de sesión correcto.",
            alumno: alumnoSeguro,
            cuotas: cuotas,
            saldo: saldo
        });

    } catch (error) {

        console.error("ERROR INTERNO EN LOGIN:", error);

        res.status(500).json({
            error: "Error interno al iniciar sesión.",
            detalle: error.message
        });
    }
});

// ==========================================
// INICIAR SERVIDOR
// ==========================================

if (require.main === module) {

    const PORT = process.env.PORT || 3000;

    app.listen(PORT, function () {

        console.log(
            "================================="
        );

        console.log(
            "Mi Cuenta ISPI iniciado correctamente"
        );

        console.log(
            "Servidor: http://localhost:" + PORT
        );

        console.log(
            "================================="
        );

    });
}

// ==========================================
// EXPORTAR PARA VERCEL
// ==========================================

module.exports = app;